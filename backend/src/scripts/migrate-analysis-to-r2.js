import 'dotenv/config'
import mongoose from 'mongoose'
import { AnalysisImage, AnalysisDocument } from '../models/analysis.model.js'
import { uploadAnalysisBuffer } from '../config/analysisR2.js'

// Run from the backend folder while uploads/deletion are stopped.
// Supply the same MongoDB URI used by your server if its variable differs.
const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGO_URL
if (!uri) throw new Error('Set MONGODB_URI to the same database URI used by your backend.')

let images = 0
let documents = 0
try {
  await mongoose.connect(uri)
  for await (const image of AnalysisImage.find({ storage: { $ne: 'r2' }, data: { $exists: true } }).select('+data').cursor()) {
    if (!image.data?.length) throw new Error(`Image ${image._id} has no readable data.`)
    const type = image.contentType || 'image/webp'
    const extension = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }[type]
    if (!extension) throw new Error(`Image ${image._id} has an unsupported content type.`)
    const key = `analysis/posts/${image.postId}/${image._id}.${extension}`
    await uploadAnalysisBuffer({ key, buffer: image.data, contentType: type })
    await AnalysisImage.updateOne({ _id: image._id }, {
      $set: { storage: 'r2', key, size: image.data.length },
      $unset: { data: '' },
    })
    images++
    console.log('Migrated image:', String(image._id))
  }
  for await (const doc of AnalysisDocument.find({ hasFile: true, fileStorage: { $ne: 'r2' }, fileData: { $exists: true } }).select('+fileData').cursor()) {
    if (!doc.fileData?.length) throw new Error(`Document ${doc._id} has no readable data.`)
    const filename = (doc.filename || `reference-${doc._id}`).replace(/[^a-zA-Z0-9._-]/g, '_')
    const key = `analysis/documents/${doc._id}/${filename}`
    await uploadAnalysisBuffer({ key, buffer: doc.fileData, contentType: doc.contentType || 'application/octet-stream' })
    await AnalysisDocument.updateOne({ _id: doc._id }, {
      $set: { fileStorage: 'r2', fileKey: key, size: doc.fileData.length },
      $unset: { fileData: '' },
    })
    documents++
    console.log('Migrated document:', String(doc._id))
  }
  console.log(`Finished: ${images} images and ${documents} documents moved to R2.`)
} catch (error) {
  console.error('Migration stopped:', error.name)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}
