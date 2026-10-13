import mongoose from 'mongoose'

function isHttpUrl(value) {
  try { return ['http:', 'https:'].includes(new URL(value).protocol) }
  catch { return false }
}

const analysisSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  category: { type: String, enum: ['ICT', 'PDArray', 'CSNR', 'SMS'], required: true },
  symbol: { type: String, required: true, trim: true, uppercase: true },
  timeframe: { type: String, required: true, trim: true },
  date: { type: Date, required: true },
  pictures: {
    type: [String], default: [],
    validate: {
      validator: values => values.length <= 10 && values.every(isHttpUrl),
      message: 'Provide at most 10 valid HTTP/HTTPS chart URLs.',
    },
  },
  imageIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  details: { type: String, required: true, maxlength: 20000 },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  // Failed cleanup stays recorded so an administrator can retry deletion.
  pendingDelete: { type: Boolean, default: false },
}, { timestamps: true })

const documentSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, default: '', trim: true, maxlength: 2000 },
  type: { type: String, enum: ['PDF', 'Word Document', 'ZIP', 'Other'], required: true },
  url: {
    type: String, required: function () { return !this.hasFile },
    validate: { validator: value => !value || isHttpUrl(value), message: 'Provide a valid HTTP/HTTPS document URL.' },
  },
  hasFile: { type: Boolean, default: false },
  fileStorage: { type: String, enum: ['mongo', 'r2'], default: 'mongo' },
  fileKey: { type: String, required: function () { return this.hasFile && this.fileStorage === 'r2' } },
  // Legacy documents only. New uploads never write fileData.
  fileData: { type: Buffer, select: false },
  filename: String,
  contentType: String,
  size: { type: Number, min: 1 },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  pendingDelete: { type: Boolean, default: false },
}, { timestamps: true })

const imageSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  storage: { type: String, enum: ['mongo', 'r2'], default: 'mongo' },
  key: { type: String, required: function () { return this.storage === 'r2' } },
  // Legacy charts only. R2 charts keep metadata instead of a binary buffer.
  data: { type: Buffer, required: function () { return this.storage !== 'r2' }, select: false },
  contentType: { type: String, default: 'image/webp' },
  size: { type: Number, min: 1 },
}, { timestamps: true })

export const AnalysisPost = mongoose.model('AnalysisPost', analysisSchema)
export const AnalysisDocument = mongoose.model('AnalysisDocument', documentSchema)
export const AnalysisImage = mongoose.model('AnalysisImage', imageSchema)
