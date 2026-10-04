import mongoose from 'mongoose'

const economicEventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    country: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      match: /^[A-Z]{3}$/,
    },

    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },

    impact: {
      type: String,
      enum: ['low', 'medium', 'high', 'holiday'],
      required: true,
    },

    forecast: {
      type: String,
      default: null,
      maxlength: 100,
    },

    previous: {
      type: String,
      default: null,
      maxlength: 100,
    },

    actual: {
      type: String,
      default: null,
      maxlength: 100,
    },

    status: {
      type: String,
      enum: ['scheduled', 'released', 'cancelled'],
      default: 'scheduled',
    },

    sourceUrl: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000,
    },
  },
  {
    timestamps: true,
  }
)

export default mongoose.model('EconomicEvent', economicEventSchema)