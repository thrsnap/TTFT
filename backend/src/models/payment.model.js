import mongoose from 'mongoose'

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },

    productId: {
      type: String,
      required: true,
    },

    amountCents: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: 'amountCents must be a safe integer',
      },
    },

    currency: {
      type: String,
      enum: ['USD'],
      default: 'USD',
      required: true,
    },

    recipientAccount: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ['pending', 'paid', 'expired'],
      default: 'pending',
      required: true,
    },

    qrCode: {
      type: String,
      required: true,
    },

    qrMd5: {
      type: String,
      required: true,
      unique: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    transactionHash: {
      type: String,
    },

    paidAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
)

// A transaction cannot confirm multiple payment orders.
paymentSchema.index(
  { transactionHash: 1 },
  { unique: true, sparse: true },
)

export default mongoose.models.Payment ||
  mongoose.model('Payment', paymentSchema)