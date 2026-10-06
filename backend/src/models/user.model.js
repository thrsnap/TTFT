import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true,
      select: false,
    },

    password: {
      type: String,
      required: function () {
        return !this.googleId
      },
      select: false,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    emailCodeHash: {
      type: String,
      select: false,
    },

    emailCodeExpires: {
      type: Date,
      select: false,
    },

    emailCodeAttempts: {
      type: Number,
      default: 0,
      select: false,
    },

    emailCodeSentAt: {
      type: Date,
      default: () => new Date(0),
      select: false,
    },

    resetCodeHash: {
      type: String,
      select: false,
    },

    resetCodeExpires: {
      type: Date,
      select: false,
    },

    resetCodeAttempts: {
      type: Number,
      default: 0,
      select: false,
    },

    resetCodeSentAt: {
      type: Date,
      default: () => new Date(0),
      select: false,
    },

    resetTokenHash: {
      type: String,
      select: false,
    },

    resetTokenExpires: {
      type: Date,
      select: false,
    },

    authVersion: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
)

export default mongoose.model('User', userSchema)