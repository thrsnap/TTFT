import mongoose from 'mongoose'

const signalSchema = new mongoose.Schema(
  {
    pair: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 30,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    scheduledAt: {
      type: Date,
      required: true,
    },

    newsType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    direction: {
      type: String,
      enum: ['buy', 'sell', 'pending'],
      default: 'pending',
    },

    confirmed: {
      type: Boolean,
      default: false,
    },

    // Optional when creating an Upcoming signal.
    details: {
      type: String,
      default: '',
      maxlength: 10000,
    },

    news: {
      type: String,
      default: '',
      maxlength: 5000,
    },

    previewText: {
      type: String,
      default:
        'Subscribe to unlock the chart and technical analysis.',
      maxlength: 500,
    },

    // Optional: upload the chart later.
    image: {
      type: Buffer,
      select: false,
    },

    preview: {
      type: Buffer,
      select: false,
    },
  },
  {
    timestamps: true,
  },
)

signalSchema.index({ scheduledAt: -1 })

export default mongoose.models.Signal ||
  mongoose.model('Signal', signalSchema)