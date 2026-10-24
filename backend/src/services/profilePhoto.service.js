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
export const PROFILE_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export class ProfilePhotoError extends Error {
  constructor(status, message, code) {
    super(message)
    this.status = status
    this.code = code
  }
}

let storage

function getStorage() {
  if (storage) return storage

  const accountId = process.env.R2_ACCOUNT_ID?.trim()
  const endpoint = process.env.R2_ENDPOINT?.trim() ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '')
  const bucket = process.env.R2_BUCKET_NAME?.trim() || process.env.R2_BUCKET?.trim()
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new ProfilePhotoError(503, 'Profile photo uploads are temporarily unavailable.')
  }

  storage = {
    bucket,
    client: new S3Client({
      endpoint,
      region: 'auto',
      credentials: { accessKeyId, secretAccessKey },
      maxAttempts: 2,
    }),
  }
  return storage
}

async function send(command) {
  const { client } = getStorage()
  return client.send(command, { abortSignal: AbortSignal.timeout(15000) })
}

export async function prepareProfilePhoto(file) {
  if (!file?.buffer?.length) {
    throw new ProfilePhotoError(400, 'Choose a photo to upload.')
  }
  if (file.buffer.length > MAX_PROFILE_PHOTO_SIZE) {
    throw new ProfilePhotoError(413, 'Choose a photo smaller than 2 MB.')
  }
  if (!PROFILE_PHOTO_TYPES.includes(file.mimetype)) {
    throw new ProfilePhotoError(400, 'Choose a JPG, PNG or WebP image.')
  }

  try {
    const image = sharp(file.buffer, {
      limitInputPixels: 20_000_000,
      failOn: 'warning',
    })
    const metadata = await image.metadata()
    if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) {
      throw new Error('Unsupported image format')
    }

    return await image
      .rotate()
      .resize(512, 512, { fit: 'cover', position: 'centre' })
      .webp({ quality: 85 })
      .toBuffer()
  } catch {
    throw new ProfilePhotoError(400, 'This photo could not be read. Choose a valid, non-animated JPG, PNG or WebP image up to 20 megapixels.')
  }
}

async function deleteStoredPhoto(key) {
  if (!key) return
  try {
    const { bucket } = getStorage()
    await send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  } catch (error) {
    // The saved account photo has already changed. A cleanup failure must not
    // undo the new photo or report a successful save as failed.
    console.warn('Could not remove an old profile photo:', key, error?.name)
  }
}

export async function readProfilePhoto(userId) {
  const photo = await ProfilePhoto.findOne({ userId }).lean()
  if (!photo) return null

  const { bucket } = getStorage()
  try {
    const result = await send(new GetObjectCommand({ Bucket: bucket, Key: photo.key }))
    const bytes = await result.Body.transformToByteArray()
    return Buffer.from(bytes)
  } catch (error) {
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) return null
    throw error
  }
}

export async function saveProfilePhoto(userId, file) {
  const body = await prepareProfilePhoto(file)
  const { bucket } = getStorage()
  const key = `profile-photos/${String(userId)}/${randomUUID()}.webp`

  await send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: 'image/webp',
    CacheControl: 'private, no-store',
  }))

  let previous
  // The unique owner index prevents two first uploads creating two profiles.
  // Retry a competing first upsert once, updating its newly created record.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      previous = await ProfilePhoto.findOneAndUpdate(
        { userId },
        { $set: { key, contentType: 'image/webp', size: body.length } },
        { new: false, upsert: true, runValidators: true },
      ).lean()
      break
    } catch (error) {
      if (error?.code === 11000 && attempt === 0) continue
      // A database acknowledgement can be lost after a successful write.
      // Keep this object on an uncertain failure so a committed photo stays valid.
      throw error
    }
  }

  await deleteStoredPhoto(previous?.key)
  return body
}

export async function removeProfilePhoto(userId) {
  const previous = await ProfilePhoto.findOneAndDelete({ userId }).lean()
  await deleteStoredPhoto(previous?.key)
}
