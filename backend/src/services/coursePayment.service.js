import mongoose from 'mongoose'
import User from '../models/user.model.js'
import Payment from '../models/payment.model.js'
import { Course, CourseEnrollment } from '../models/course.model.js'

function paymentError(message, status, code) {
  const error = new Error(message)
  error.status = status
  error.code = code
  return error
}

export function courseIdFromProduct(productId) {
  return typeof productId === 'string'
    ? /^course:([a-f0-9]{24})$/i.exec(productId)?.[1].toLowerCase() || null
    : null
}

export async function resolveCourseProduct(userId, productId) {
  const courseId = courseIdFromProduct(productId)
  if (!courseId) throw paymentError('Invalid course ID.', 400, 'INVALID_COURSE')
  if (!mongoose.isObjectIdOrHexString(userId)) {
    throw paymentError('Please sign in with your registered account.', 401, 'INVALID_SESSION')
  }

  const course = await Course.findOne({ _id: courseId, status: 'published' })
  if (!course) throw paymentError('Course not found or unavailable for purchase.', 404, 'COURSE_UNAVAILABLE')

  const hasAccess = await User.exists({ _id: userId, role: 'admin' }) ||
    await CourseEnrollment.exists({ userId, courseId })
  if (hasAccess) {
    throw paymentError('You already have access to this course.', 409, 'COURSE_ACCESS_ALREADY_GRANTED')
  }

  const price = Number(course.price)
  const amountCents = Math.round(price * 100)
  if (course.currency !== 'USD' || !Number.isFinite(price) || price <= 0 ||
      !Number.isSafeInteger(amountCents) || amountCents < 1 ||
      Math.abs(price * 100 - amountCents) > 0.000001) {
    throw paymentError('The course has an invalid configured price.', 503, 'PAYMENT_CONFIG_ERROR')
  }

  return { amountCents, courseId, courseTitle: course.title }
}

export async function fulfillCoursePayment(payment) {
  const courseId = courseIdFromProduct(payment?.productId)
  if (!courseId) return {}
  const result = { courseId, courseTitle: payment.courseTitle || null, accessGranted: false }
  if (payment.status !== 'paid') return result

  // Only new server-priced course orders can grant access automatically.
  // Old test orders remain paid receipts requiring review, not another payment.
  if (!payment.courseId || String(payment.courseId).toLowerCase() !== courseId ||
      !mongoose.isObjectIdOrHexString(payment.userId) || !mongoose.isObjectIdOrHexString(payment._id) ||
      !payment.paidAt || !Number.isFinite(new Date(payment.paidAt).getTime()) ||
      typeof payment.transactionHash !== 'string' || !payment.transactionHash.trim()) {
    return { ...result, manualReviewRequired: true }
  }

  if (!(await Course.exists({ _id: courseId }))) {
    return { ...result, courseDeleted: true }
  }

  const key = { userId: payment.userId, courseId }
  if (!(await CourseEnrollment.exists(key))) {
    // A repaired receipt must not undo an admin's later access revocation.
    if (payment.courseFulfilledAt) return { ...result, accessRevoked: true }
    try {
      await CourseEnrollment.create({
        ...key,
        grantSource: 'bakong',
        paymentId: payment._id,
        grantedAt: payment.paidAt,
      })
    } catch (error) {
      // Concurrent checks may fulfill the same receipt. The existing unique
      // user/course index permits one grant; all other errors remain retryable.
      if (error.code !== 11000 || !(await CourseEnrollment.exists(key))) throw error
    }
  }
  await Payment.updateOne({
    _id: payment._id, status: 'paid', courseFulfilledAt: { $exists: false },
  }, { $set: { courseFulfilledAt: new Date() } }, { runValidators: true })
  return { ...result, accessGranted: true }
}
