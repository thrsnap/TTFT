
import { randomUUID } from 'node:crypto'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
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
    this.statusCode = status
    this.code = code
  }
}

let s3Client

function getStorage() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim()

  const endpoint = (
    process.env.R2_ENDPOINT?.trim() ||
    (accountId
      ? `https://${accountId}.r2.cloudflarestorage.com`
      : '')
  ).replace(/\/+$/, '')

  const bucket =
    process.env.R2_BUCKET_NAME?.trim() ||
    process.env.R2_BUCKET?.trim()

  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Cloudflare R2 configuration is incomplete. Check R2_ENDPOINT or R2_ACCOUNT_ID, R2_BUCKET_NAME or R2_BUCKET, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.',
    )
  }

  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      maxAttempts: 2,
    })
  }

  return { client: s3Client, bucket }
}

function validateUserId(userId) {
  const id = String(userId ?? '').trim()

  if (!/^[a-fA-F0-9]{24}$/.test(id)) {
    throw new ProfilePhotoError(
      400,
      'A valid user ID is required.',
      'PROFILE_PHOTO_INVALID_USER_ID',
    )
  }

  return id
}

function isMissingR2Object(error) {
  return (
    error?.name === 'NoSuchKey' ||
    error?.name === 'NotFound' ||
    error?.$metadata?.httpStatusCode === 404
  )
}

async function prepareProfilePhoto(file) {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    throw new ProfilePhotoError(
      400,
      'Choose a photo to upload.',
      'PROFILE_PHOTO_FILE_REQUIRED',
    )
  }

  if (!file.buffer.length) {
    throw new ProfilePhotoError(
      400,
      'The uploaded photo is empty.',
      'PROFILE_PHOTO_EMPTY',
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

  let metadata

  try {
    metadata = await sharp(file.buffer, {
      failOn: 'error',
    }).metadata()
  } catch {
    throw new ProfilePhotoError(
      400,
      'The image is invalid or cannot be processed.',
      'PROFILE_PHOTO_INVALID_IMAGE',
    )
  }

  if (!['jpeg', 'png', 'webp'].includes(metadata.format)) {
    throw new ProfilePhotoError(
      400,
      'The uploaded file is not a supported image.',
      'PROFILE_PHOTO_INVALID_IMAGE',
    )
  }

  try {
    return await sharp(file.buffer, {
      failOn: 'error',
    })
      .rotate()
      .resize(512, 512, {
        fit: 'cover',
        position: 'attention',
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer()
  } catch {
    throw new ProfilePhotoError(
      400,
      'The image is invalid or cannot be processed.',
      'PROFILE_PHOTO_INVALID_IMAGE',
    )
  }
}

async function deleteR2Object(key) {
  if (!key) return

  const { client, bucket } = getStorage()

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  )
}

// Read the stored photo from MongoDB and Cloudflare R2.
export async function readProfilePhoto(userId) {
  const id = validateUserId(userId)
  const startedAt = Date.now()

  try {
    const photo = await ProfilePhoto.findOne({
      userId: id,
    }).lean()

    console.log('[PROFILE PHOTO] MongoDB lookup:', {
      found: Boolean(photo),
      durationMs: Date.now() - startedAt,
      requestedUserId: id,
      savedUserId: photo?.userId ? String(photo.userId) : null,
      hasKey: Boolean(photo?.key),
    })

    // No saved photo is a normal condition for a new user.
    if (!photo) return null

    if (!photo.key) {
      throw new ProfilePhotoError(
        500,
        'The profile photo record has no storage key.',
        'PROFILE_PHOTO_KEY_MISSING',
      )
    }

    const { client, bucket } = getStorage()

    const result = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: photo.key,
      }),
    )

    if (!result.Body) {
      throw new ProfilePhotoError(
        502,
        'Cloudflare R2 returned an empty image.',
        'PROFILE_PHOTO_R2_EMPTY',
      )
    }

    const bytes = await result.Body.transformToByteArray()
    const body = Buffer.from(bytes)

    console.log('[PROFILE PHOTO] R2 read successful:', {
      durationMs: Date.now() - startedAt,
      sizeBytes: body.length,
    })

    return body
  } catch (error) {
    console.error('[PROFILE PHOTO] Read failed:', {
      userId: id,
      errorName: error?.name,
      errorCode: error?.code,
      statusCode: error?.$metadata?.httpStatusCode,
    })

    if (error instanceof ProfilePhotoError) {
      throw error
    }

    if (isMissingR2Object(error)) {
      throw new ProfilePhotoError(
        500,
        'The photo record exists, but its image is missing from R2.',
        'PROFILE_PHOTO_OBJECT_MISSING',
      )
    }

    throw error
  }
}

// Save or replace the signed-in user's photo.
export async function saveProfilePhoto(userId, file) {
  const id = validateUserId(userId)
  const body = await prepareProfilePhoto(file)
  const { client, bucket } = getStorage()

  const key = `profile-photos/${id}/${randomUUID()}.webp`

  // Upload first so the existing photo stays intact if upload fails.
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'image/webp',
      ContentLength: body.length,
      CacheControl: 'private, no-store',
    }),
  )

  let previous

  try {
    previous = await ProfilePhoto.findOneAndUpdate(
      { userId: id },
      {
        $set: {
          key,
          contentType: 'image/webp',
          size: body.length,
        },
        $setOnInsert: {
          userId: id,
        },
      },
      {
        new: false,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    ).lean()
  } catch (error) {
    // Clean up the new object if MongoDB did not save its reference.
    try {
      await deleteR2Object(key)
    } catch (cleanupError) {
      console.error(
        '[PROFILE PHOTO] New-object cleanup failed:',
        cleanupError?.name,
      )
    }

    throw error
  }

  // Remove the old image only after MongoDB points to the new image.
  if (previous?.key && previous.key !== key) {
    try {
      await deleteR2Object(previous.key)
    } catch (error) {
      console.error(
        '[PROFILE PHOTO] Old-object cleanup failed:',
        error?.name,
      )
    }
  }

  console.log('[PROFILE PHOTO] Saved successfully:', {
    userId: id,
    sizeBytes: body.length,
  })

  return body
}

// Remove the signed-in user's photo.
export async function removeProfilePhoto(userId) {
  const id = validateUserId(userId)

  const photo = await ProfilePhoto.findOneAndDelete({
    userId: id,
  }).lean()

  if (!photo?.key) {
    return
  }

  try {
    await deleteR2Object(photo.key)
  } catch (error) {
    // The database record is already deleted; log any orphaned R2 object.
    console.error(
      '[PROFILE PHOTO] R2 deletion failed:',
      error?.name,
    )
  }
}
