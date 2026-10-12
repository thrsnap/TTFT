import mongoose from 'mongoose'

const mediaSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
    },

    name: {
      type: String,
      required: true,
      maxlength: 255,
    },

    type: {
      type: String,
      required: true,
    },

    size: {
      type: Number,
      required: true,
      min: 1,
    },

    kind: {
      type: String,
      required: true,
      enum: [
        'signal-image',
        'course-video',
        'course-cover',
      ],
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

export default mongoose.models.Media ||
  mongoose.model('Media', mediaSchema)