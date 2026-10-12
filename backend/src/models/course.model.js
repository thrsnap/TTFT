import mongoose from 'mongoose'

const { Schema } = mongoose

const lessonSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  // R2 object key for new uploads; filename for legacy local lessons.
  videoFile: { type: String, required: true },
  videoStorage: { type: String, enum: ['local', 'r2'], default: 'local' },
  contentType: { type: String, enum: ['video/mp4', 'video/webm'], required: true },
  size: { type: Number, required: true, min: 1 },
})

const courseSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, default: '', maxlength: 10000 },
  mentor: { type: String, required: true, trim: true, maxlength: 120 },
  price: {
    type: Number, required: true, min: 0.01, max: 100000,
    validate: {
      validator: value => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001,
      message: 'Use no more than two decimal places.',
    },
  },
  currency: { type: String, enum: ['USD'], default: 'USD' },
  // New cover uploads store only an R2 key in MongoDB.
  coverKey: { type: String, default: '' },
  coverMimeType: { type: String, enum: ['image/jpeg', 'image/png'] },
  coverUpdatedAt: Date,
  // Read-only compatibility: the new upload route never writes this field.
  // Replacing a legacy cover removes its old Buffer from MongoDB.
  coverImage: { type: Buffer, select: false },
  thumbnail: {
    type: String, default: '',
    validate: {
      validator: value => {
        if (!value) return true
        try {
          const url = new URL(value)
          return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
        } catch { return false }
      },
      message: 'Use an HTTP/HTTPS thumbnail URL without login credentials.',
    },
  },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  lessons: { type: [lessonSchema], default: [] },
}, { timestamps: true, optimisticConcurrency: true })

const enrollmentSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'PaidCourse', required: true },
  grantedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  grantedAt: { type: Date, default: Date.now },
}, { timestamps: true })
enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true })

const paymentSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'PaidCourse', required: true },
  reference: { type: String, required: true, trim: true, maxlength: 120 },
  amount: { type: Number, required: true },
  currency: { type: String, enum: ['USD'], default: 'USD' },
  status: { type: String, enum: ['pending', 'approved'], default: 'pending' },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
}, { timestamps: true })
paymentSchema.index({ userId: 1, courseId: 1 }, {
  unique: true, partialFilterExpression: { status: 'pending' },
})

export const Course = mongoose.models.PaidCourse || mongoose.model('PaidCourse', courseSchema)
export const CourseEnrollment = mongoose.models.CourseEnrollment || mongoose.model('CourseEnrollment', enrollmentSchema)
export const CoursePayment = mongoose.models.CoursePayment || mongoose.model('CoursePayment', paymentSchema)