import 'dotenv/config'
import { createReadStream } from 'node:fs'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

let client
function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is missing from your backend .env`)
  return value
}
export function getR2Bucket() { return required('R2_BUCKET_NAME') }
export function getR2() {
  if (client) return client
  const url = new URL(required('R2_ENDPOINT'))
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new Error('R2_ENDPOINT must be the HTTPS S3 endpoint without a bucket name or path.')
  }
  client = new S3Client({
    region: 'auto', endpoint: url.origin,
    credentials: {
      accessKeyId: required('R2_ACCESS_KEY_ID'),
      secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
  return client
}
export async function uploadR2File({ key, filePath, contentType, size }) {
  const stream = createReadStream(filePath)
  try {
    await getR2().send(new PutObjectCommand({
      Bucket: getR2Bucket(), Key: key, Body: stream,
      ContentType: contentType, ContentLength: size,
      CacheControl: 'private, no-store',
    }))
  } finally { stream.destroy() }
}
export async function deleteR2File(key) {
  await getR2().send(new DeleteObjectCommand({ Bucket: getR2Bucket(), Key: key }))
}

// Retained for the earlier generic admin media preview route.
export async function getR2ReadUrl(key) {
  return getSignedUrl(getR2(), new GetObjectCommand({
    Bucket: getR2Bucket(), Key: key,
  }), { expiresIn: 3600 })
}