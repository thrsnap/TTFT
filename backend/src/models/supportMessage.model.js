import mongoose from 'mongoose'
const replySchema = new mongoose.Schema({
  body: { type: String, required: true, trim: true, maxlength: 4000 },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  topic: { type: String, required: true, enum: ['General question', 'Account support', 'Academy and courses', 'Trading challenge', 'Broker collaboration', 'Technical issue', 'Other'] },
  subject: { type: String, required: true, trim: true, maxlength: 150 },
  message: { type: String, required: true, trim: true, minlength: 20, maxlength: 2000 },
  guestTokenHash: { type: String, select: false },
  status: { type: String, enum: ['open', 'replied', 'closed'], default: 'open' },
  replies: { type: [replySchema], default: [] },
}, { timestamps: true })
schema.index({ status: 1, createdAt: -1 })
export default mongoose.model('SupportMessage', schema)
