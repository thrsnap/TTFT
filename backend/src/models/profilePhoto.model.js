import mongoose from 'mongoose'

const profilePhotoSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
    key: { type: String, required: true },
    contentType: { type: String, enum: ['image/webp'], required: true },
    size: { type: Number, required: true, min: 1 },
  },
  { timestamps: true },
)

profilePhotoSchema.index({ userId: 1 }, { unique: true })

export default mongoose.models.ProfilePhoto ||
  mongoose.model('ProfilePhoto', profilePhotoSchema)
