import mongoose from 'mongoose'

const journalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },

    pair: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 30,
    },

    direction: {
      type: String,
      enum: ['buy', 'sell'],
      required: true,
    },

    result: {
      type: String,
      enum: ['profit', 'loss', 'breakeven'],
      required: true,
    },

    // Always positive. The result determines the displayed + or − sign.
    amount: {
      type: Number,
      required: true,
      min: 0,
      max: 999999999,
      validate: {
        validator: Number.isFinite,
        message: 'Enter a valid amount.',
      },
    },

    currency: {
      type: String,
      enum: ['USD', 'KHR', 'EUR', 'GBP', 'INR'],
      default: 'USD',
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    imageKey: {
      type: String,
      default: '',
    },

    imageMimeType: {
      type: String,
      enum: ['', 'image/jpeg', 'image/png', 'image/webp'],
      default: '',
    },
  },
  {
    timestamps: true,
  },
)

journalSchema.pre('validate', function () {
  if (this.result === 'breakeven') {
    this.amount = 0
  } else if (
    ['profit', 'loss'].includes(this.result) &&
    !(this.amount > 0)
  ) {
    this.invalidate(
      'amount',
      'Profit or loss amount must be greater than zero.',
    )
  }
})

journalSchema.index({ createdAt: -1, _id: -1 })
journalSchema.index({ userId: 1, createdAt: -1, _id: -1 })
journalSchema.index({ result: 1, createdAt: -1, _id: -1 })

export default mongoose.models.Journal ||
  mongoose.model('Journal', journalSchema)