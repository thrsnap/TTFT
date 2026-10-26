import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  eventId: { type: String, required: true },
  subscriptionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  bindingVersion: { type: String, required: true },
  acceptedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
})

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default mongoose.models.SignalPushDelivery || mongoose.model('SignalPushDelivery', schema)
