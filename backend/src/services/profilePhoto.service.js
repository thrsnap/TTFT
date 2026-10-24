
import { randomUUID } from 'node:crypto'
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import sharp from 'sharp'
import ProfilePhoto from '../models/profilePhoto.model.js'

export const MAX_PROFILE_PHOTO_SIZE = 2 * 1024 * 1024

export const PROFILE_PHOTO_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
]

export class ProfilePhotoError extends Error {
  constructor(status, message, code) {
    super(message)
    this.name = 'ProfilePhotoError'
    this.status = status
    this.code = code
  }
}

let storage

function getStorage() {
  if (storage) return storage

  const accountId = process.env.R2_ACCOUNT_ID?.trim()

  const endpoint =
    process.env.R2_ENDPOINT?.trim() ||
    (accountId
      ? `https://${accountId}.r2.cloudflarestorage.com`
      : '')

  const bucket =
    process.env.R2_BUCKET_NAME?.trim() ||
    process.env.R2_BUCKET?.trim()

  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new ProfilePhotoError(
      503,
      'Profile photo storage is temporarily unavailable.',
      'PROFILE_PHOTO_STORAGE_UNAVAILABLE',
    )
  }

  storage = {
    bucket,
    client: new S3Client({
      endpoint,
      region: 'auto',
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      maxAttempts: 2,
    }),
  }

  return storage
}

async function send(command) {
  const { client } = getStorage()

  return client.send(command, {
    abortSignal: AbortSignal.timeout(15000),
  })
}

export async function prepareProfilePhoto(file) {
  if (!file?.buffer?.length) {
    throw new ProfilePhotoError(
      400,
      'Choose a photo to upload.',
      'PROFILE_PHOTO_REQUIRED',
    )
  }

  if (file.buffer.length > MAX_PROFILE_PHOTO_SIZE) {
    throw new ProfilePhotoError(
      413,
      'Choose a photo smaller than 2 MB.',
      'PROFILE_PHOTO_TOO_LARGE',
    )
  }

  if (!PROFILE_PHOTO_TYPES.includes(file.mimetype)) {
    throw new ProfilePhotoError(
      400,
      'Choose a JPG, PNG or WebP image.',
      'PROFILE_PHOTO_INVALID_TYPE',
    )
  }

  try {
    const image = sharp(file.buffer, {
      limitInputPixels: 20_000_000,
      failOn: 'warning',
    })

    const metadata = await image.metadata()

    if (
      !['jpeg', 'png', 'webp'].includes(metadata.format) ||
      (metadata.pages || 1) > 1
    ) {
      throw new Error('Unsupported image format')
    }

    return await image
      .rotate()
      .resize(512, 512, {
        fit: 'cover',
        position: 'centre',
      })
      .webp({ quality: 85 })
      .toBuffer()
  } catch {
    throw new ProfilePhotoError(
      400,
      'This photo could not be read. Choose a valid, non-animated JPG, PNG or WebP image up to 20 megapixels.',
      'PROFILE_PHOTO_INVALID_IMAGE',
    )
  }
}

async function deleteStoredPhoto(key) {
  if (!key) return

  try {
    const { bucket } = getStorage()

    await send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    )
  } catch (error) {
    // The new photo has already been saved.
    // A cleanup failure must not invalidate that save.
    console.warn(
      'Could not remove an old profile photo:',
      key,
      error?.name,
    )
  }
}

export async function readProfilePhoto(userId) {
  const photo = await ProfilePhoto.findOne({ userId }).lean()

  if (!photo) return null

  const { bucket } = getStorage()

  try {
    const result = await send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: photo.key,
      }),
    )

    if (!result.Body) {
      console.warn('R2 returned an empty profile photo body:', photo.key)
      return null
    }

    const bytes = await result.Body.transformToByteArray()

    return Buffer.from(bytes)
  } catch (error) {
    if (
      error?.name === 'NoSuchKey' ||
      error?.name === 'NotFound' ||
      error?.$metadata?.httpStatusCode === 404
    ) {
      console.warn('Profile photo object was not found in R2:', photo.key)
      return null
    }

    console.error(
      'Failed to read profile photo from R2:',
      error?.name,
    )

    throw error
  }
}

export async function saveProfilePhoto(userId, file) {
  const body = await prepareProfilePhoto(file)
  const { bucket } = getStorage()

  const key = `profile-photos/${String(userId)}/${randomUUID()}.webp`

  await send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'image/webp',
      CacheControl: 'private, no-store',
    }),
  )

  let previous

  // Retry once if simultaneous first uploads cause a unique-index conflict.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      previous = await ProfilePhoto.findOneAndUpdate(
        { userId },
        {
          $set: {
            key,
            contentType: 'image/webp',
            size: body.length,
          },
        },
        {
          new: false,
          upsert: true,
          runValidators: true,
        },
      ).lean()

      break
    } catch (error) {
      if (error?.code === 11000 && attempt === 0) {
        continue
      }

      // Keep the uploaded object if the database write outcome is uncertain.
      // This avoids deleting a photo that may already be referenced.
      console.error(
        'Failed to save profile photo record:',
        error?.name,
      )

      throw error
    }
  }

  // Remove the previous object only after the database update succeeds.
  await deleteStoredPhoto(previous?.key)

  return body
}

export async function removeProfilePhoto(userId) {
  const previous = await ProfilePhoto.findOneAndDelete({
    userId,
  }).lean()

  await deleteStoredPhoto(previous?.key)
}
