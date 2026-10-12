import mongoose from 'mongoose'

const newsSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      default: '',
    },

    image: {
      type: String,
      default: '',
    },

    link: {
      type: String,
      required: true,
    },

    publishedAt: {
      type: Date,
      default: null,
    },

    source: {
      type: String,
      required: true,
      default: 'Investing.com',
    },

    category: {
      type: String,
      required: true,
      enum: [
        'Economy',
        'Markets',
        'Insider Trading',
        'Forex',
        'Crypto',
      ],
    },
  },
  {
    // createdAt records when an article was first saved.
    timestamps: true,
  },
)

newsSchema.index(
  {
    source: 1,
    category: 1,
    link: 1,
  },
  {
    unique: true,
  },
)

newsSchema.index({
  source: 1,
  category: 1,
  publishedAt: -1,
  createdAt: -1,
})

export default mongoose.models.News ||
  mongoose.model('News', newsSchema)