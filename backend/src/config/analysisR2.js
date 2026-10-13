import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getR2, getR2Bucket } from './r2.js'

// Uses your existing R2 client. Course/video upload helpers remain unchanged.
export async function uploadAnalysisBuffer({ key, buffer, contentType }) {
  await getR2().send(new PutObjectCommand({
    Bucket: getR2Bucket(), Key: key, Body: buffer,
    ContentType: contentType, ContentLength: buffer.length,
    CacheControl: 'private, no-store',
  }))
}

export function readAnalysisObject(key) {
  return getR2().send(new GetObjectCommand({ Bucket: getR2Bucket(), Key: key }))
}
