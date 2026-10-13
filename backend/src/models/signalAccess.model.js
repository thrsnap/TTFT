import mongoose from 'mongoose'

const signalAccessSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // null grants access to all signals.
    signalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Signal',
      default: null,
    },

    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

signalAccessSchema.index(
  {
    userId: 1,
    signalId: 1,
  },
  {
    unique: true,
  },
)

export default mongoose.models.SignalAccess ||
  mongoose.model('SignalAccess', signalAccessSchema)