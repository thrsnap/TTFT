import mongoose from 'mongoose'

const keySchema = new mongoose.Schema(
  {
    p256dh: { type: String, required: true, maxlength: 100 },
    auth: { type: String, required: true, maxlength: 30 },
  },
  { _id: false },
)

const pushSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
      index: true,
    },
    endpointHash: {
      type: String,
      required: true,
      immutable: true,
      unique: true,
      minlength: 64,
      maxlength: 64,
    },
    endpoint: {
      type: String,
      required: true,
      maxlength: 4096,
      select: false,
    },
    keys: { type: keySchema, required: true, select: false },
    expirationTime: { type: Date, default: null },
    vapidPublicKey: { type: String, required: true },
    bindingVersion: { type: String, required: true, maxlength: 36 },
    lastTestAt: { type: Date, default: null },
  },
  { timestamps: true },
)

export default mongoose.models.PushSubscription ||
  mongoose.model('PushSubscription', pushSubscriptionSchema)
