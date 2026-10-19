import { getAdminPayments } from '../controllers/AdminPayments.controller.js'
import { Router } from 'express'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import User from '../models/user.model.js'
import SignalAccess from '../models/signalAccess.model.js'
import Payment from '../models/payment.model.js'
import DailySignalSubscription from '../models/dailySignalSubscription.model.js'
import DailySignalGrant from '../models/dailySignalGrant.model.js'
import { getDailySubscription } from '../services/dailySignalAccess.service.js'
import {
  Course,
  CourseEnrollment,
  CoursePayment,
} from '../models/course.model.js'

const router = Router()
const run = handler => (req, res, next) =>
  Promise.resolve()
    .then(() => handler(req, res, next))
    .catch(next)
function fail(message, status = 400) {
  const error = new Error(message)
  error.status = status
  return error
}
function validId(value) {
  if (
    typeof value !== 'string' ||
    !mongoose.isObjectIdOrHexString(value)
  ) {
    throw fail('Invalid ID.')
  }
  return value
}
function jsonBody(body) {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    throw fail('Send a JSON object.')
  }
  return body
}
const selection =
  'username email role emailVerified createdAt lastSeenAt authVersion'
async function findUser(value) {
  const user = await User.findById(validId(value))
    .select(selection)
    .select('+googleId')
    .lean()
  if (!user) throw fail('User not found.', 404)
  return user
}
function safeUser(user) {
  return {
    id: String(user._id),
    username: user.username,
    email: user.email,
    role: user.role || 'user',
    emailVerified: Boolean(user.emailVerified),
    isGoogleAccount: Boolean(user.googleId),
    createdAt: user.createdAt,
    lastSeenAt: user.lastSeenAt,
    active: Boolean(
      user.lastSeenAt &&
      new Date(user.lastSeenAt).getTime() >=
        Date.now() - 15 * 60 * 1000,
    ),
  }
}
function courseInfo(enrollment) {
  return {
    id: String(enrollment.courseId._id),
    title: enrollment.courseId.title,
    grantedAt: enrollment.grantedAt,
  }
}
function subscriptionInfo(subscription) {
  if (!subscription) return null
  return {
    expiresAt: subscription.expiresAt,
    active:
      new Date(subscription.expiresAt).getTime() > Date.now(),
  }
}
function escapeRegex(value) {
  const slash = String.fromCharCode(92)
  const special = '.*+?^${}()|[]' + slash
  return Array.from(value, char => special.includes(char) ? slash + char : char).join('')
}
function validateBody(body, creating = false) {
  jsonBody(body)
  const allowed = [
    'username',
    'email',
    'password',
    'role',
    'emailVerified',
  ]
  if (Object.keys(body).some(key => !allowed.includes(key))) {
    throw fail('Unsupported user fields.')
  }
  const result = {}
  if (creating || Object.hasOwn(body, 'username')) {
    const value = typeof body.username === 'string'
      ? body.username.trim().toLowerCase()
      : ''
    if (!/^[a-z0-9_]{3,30}$/.test(value)) {
      throw fail(
        'Username must contain 3–30 letters, numbers or underscores.',
      )
    }
    result.username = value
  }
  if (creating || Object.hasOwn(body, 'email')) {
    const value = typeof body.email === 'string'
      ? body.email.trim().toLowerCase()
      : ''
    if (
      value.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ) {
      throw fail('Enter a valid email address.')
    }
    result.email = value
  }
  if (creating || Object.hasOwn(body, 'password')) {
    if (
      typeof body.password !== 'string' ||
      body.password.length < 12 ||
      Buffer.byteLength(body.password, 'utf8') > 72
    ) {
      throw fail(
        'Password must have at least 12 characters and at most 72 UTF-8 bytes.',
      )
    }
    result.password = body.password
  }
  if (Object.hasOwn(body, 'role')) {
    if (!['user', 'admin'].includes(body.role)) {
      throw fail('Role must be user or admin.')
    }
    result.role = body.role
  } else if (creating) {
    result.role = 'user'
  }
  if (Object.hasOwn(body, 'emailVerified')) {
    if (typeof body.emailVerified !== 'boolean') {
      throw fail('emailVerified must be true or false.')
    }
    result.emailVerified = body.emailVerified
  } else if (creating) {
    result.emailVerified = false
  }
  if (!creating && !Object.keys(result).length) {
    throw fail('Provide fields to update.')
  }
  return result
}
// This router verifies sessions itself.
// It does not depend on an admin API key.
router.use(run(async (req, res, next) => {
  const userId = req.session?.userId
  const user =
    typeof userId === 'string' &&
    mongoose.isObjectIdOrHexString(userId)
      ? await User.findById(userId)
      : null
  if (
    !user?.emailVerified ||
    (req.session?.authVersion ?? 0) !==
      (user.authVersion ?? 0)
  ) {
    return res.status(401).json({
      message: 'Please log in.',
    })
  }
  if (user.role !== 'admin') {
    return res.status(403).json({
      message: 'Admin access is required.',
    })
  }
  req.user = user
  const now = new Date()
  const cutoff = new Date(now.getTime() - 60_000)
  if (
    !user.lastSeenAt ||
    new Date(user.lastSeenAt) <= cutoff
  ) {
    await User.updateOne(
      {
        _id: user._id,
        $or: [
          { lastSeenAt: { $lte: cutoff } },
          { lastSeenAt: null },
        ],
      },
      { $set: { lastSeenAt: now } },
    )
  }
  next()
}))
// Request protection for admin JSON mutations.
router.use((req, res, next) => {
  res.set('Cache-Control', 'private, no-store')
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next()
  }
  const origin = req.get('Origin')
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.ADMIN_FRONTEND_URL,
  ]
    .filter(Boolean)
    .map(value => new URL(value.trim()).origin)
  if (
    req.get('X-CMM-Request') !== '1' ||
    (origin && !allowedOrigins.includes(origin))
  ) {
    return res.status(403).json({
      message: 'Request not allowed.',
    })
  }
  if (
    ['POST', 'PUT', 'PATCH'].includes(req.method) &&
    !req.is('application/json')
  ) {
    return res.status(400).json({
      message: 'Send an application/json body.',
    })
  }
  next()
})
// ADMIN IDENTITY
router.get('/check', (req, res) => {
  res.json({
    message: 'Admin access confirmed',
    user: {
      id: String(req.user._id),
      username: req.user.username,
      role: req.user.role,
    },
  })
})
// DASHBOARD STATISTICS
router.get('/dashboard', run(async (req, res) => {
  const now = new Date()
  const newUserSince = new Date(now)
  newUserSince.setDate(newUserSince.getDate() - 30)
  const activeSince = new Date(
    now.getTime() - 15 * 60 * 1000,
  )
  const [
    totalUsers,
    newUsers,
    verifiedUsers,
    activeUsers,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({
      createdAt: { $gte: newUserSince },
    }),
    User.countDocuments({ emailVerified: true }),
    User.countDocuments({
      lastSeenAt: { $gte: activeSince },
    }),
  ])
  res.json({
    totalUsers,
    newUsers,
    verifiedUsers,
    activeUsers,
  })
}))
// Read-only payment history, protected by the session/admin middleware above.
router.get('/payments', getAdminPayments)

// Daily Signal access is independent from course and News Signal access.
router.get('/users/:id/daily-access', run(async (req, res) => {
  const user = await findUser(req.params.id)
  res.json({ dailySubscription: await getDailySubscription(user._id) })
}))

router.patch('/users/:id/daily-access', run(async (req, res) => {
  const user = await findUser(req.params.id)
  const body = jsonBody(req.body)
  if (Object.keys(body).some(key => key !== 'expiresAt')) throw fail('Only expiresAt is allowed.')
  if (typeof body.expiresAt !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/i.test(body.expiresAt)) {
    throw fail('Send an ISO expiry date with a timezone.')
  }
  const now = new Date()
  const expiresAt = new Date(body.expiresAt)
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now) throw fail('Daily expiry must be in the future.')
  await DailySignalGrant.findOneAndUpdate({ userId: user._id }, {
    $set: { grantedBy: req.user._id, startsAt: now, expiresAt },
  }, { upsert: true, runValidators: true, returnDocument: 'after' })
  res.json({ message: 'Manual Daily Signal access saved. No paid receipt was created.', dailySubscription: await getDailySubscription(user._id) })
}))

router.delete('/users/:id/daily-access', run(async (req, res) => {
  const user = await findUser(req.params.id)
  const now = new Date()
  // Expire both forms of access; retain paid receipts and access history.
  await DailySignalGrant.updateMany({ userId: user._id, expiresAt: { $gt: now } }, { $set: { expiresAt: now } })
  await DailySignalSubscription.updateMany({ userId: user._id, expiresAt: { $gt: now } }, { $set: { expiresAt: now } })
  res.json({ message: 'Daily Signal access removed. Payment history is retained.', dailySubscription: await getDailySubscription(user._id) })
}))

// LIST USERS
router.get('/users', run(async (req, res) => {
  const page = req.query.page === undefined
    ? 1
    : Number(req.query.page)
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 1000000
  ) {
    throw fail('Invalid page.')
  }
  const q = req.query.q === undefined ? '' : req.query.q
  if (typeof q !== 'string' || q.length > 100) {
    throw fail('Search must be at most 100 characters.')
  }
  const filter = {}
  if (q.trim()) {
    const search = escapeRegex(q.trim())
    filter.$or = [
      { username: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ]
  }
  const limit = 20
  const [users, total] = await Promise.all([
    User.find(filter)
      .select(selection)
      .select('+googleId')
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ])
  const userIds = users.map(user => user._id)
  const [enrollments, pendingPayments, subscriptions] =
    await Promise.all([
      CourseEnrollment.find({
        userId: { $in: userIds },
      })
        .select('userId courseId grantedAt')
        .populate('courseId', 'title')
        .lean(),
      CoursePayment.find({
        userId: { $in: userIds },
        status: 'pending',
      })
        .select('userId courseId amount currency createdAt')
        .populate('courseId', 'title')
        .lean(),
      SignalAccess.find({
        userId: { $in: userIds },
        signalId: null,
      })
        .select('userId expiresAt')
        .lean(),
    ])
  const accessByUser = new Map(
    userIds.map(value => [
      String(value),
      {
        courses: [],
        pendingCoursePayments: [],
        signalAccess: null,
        signalSubscription: { status: 'none' },
      },
    ]),
  )
  for (const enrollment of enrollments) {
    const entry = accessByUser.get(String(enrollment.userId))
    if (entry && enrollment.courseId) {
      entry.courses.push(courseInfo(enrollment))
    }
  }
  for (const payment of pendingPayments) {
    const entry = accessByUser.get(String(payment.userId))
    if (entry) {
      entry.pendingCoursePayments.push({
        id: String(payment._id),
        courseTitle:
          payment.courseId?.title || 'Unavailable course',
        amount: payment.amount,
        currency: payment.currency,
      })
    }
  }
  for (const subscription of subscriptions) {
    const entry = accessByUser.get(String(subscription.userId))
    if (entry) {
      const info = subscriptionInfo(subscription)
      entry.signalAccess = info
      entry.signalSubscription = {
        status: info.active ? 'active' : 'expired',
        expiresAt: info.expiresAt,
      }
    }
  }
  res.json({
    users: users.map(user => ({
      ...safeUser(user),
      ...accessByUser.get(String(user._id)),
    })),
    total,
    page,
    limit,
    currentAdminId: String(req.user._id),
  })
}))
// CREATE USER
router.post('/users', run(async (req, res) => {
  const data = validateBody(req.body, true)
  if (data.role === 'admin' && !data.emailVerified) {
    throw fail('An admin account must be verified.')
  }
  data.password = await bcrypt.hash(data.password, 12)
  const user = await User.create(data)
  res.status(201).json({
    message: 'User created.',
    user: safeUser(user),
  })
}))
// ACCESS PANEL
router.get('/users/:id/access', run(async (req, res) => {
  const user = await findUser(req.params.id)
  const [courses, enrollments, subscription] =
    await Promise.all([
      Course.find()
        .select('_id title status')
        .sort({ title: 1 })
        .lean(),
      CourseEnrollment.find({ userId: user._id })
        .populate('courseId', 'title')
        .sort({ grantedAt: -1 })
        .lean(),
      SignalAccess.findOne({
        userId: user._id,
        signalId: null,
      }).lean(),
    ])
  res.json({
    availableCourses: courses.map(course => ({
      id: String(course._id),
      title: course.title,
      status: course.status,
    })),
    courses: enrollments
      .filter(enrollment => enrollment.courseId)
      .map(courseInfo),
    signalAccess: subscriptionInfo(subscription),
  })
}))
// GRANT COURSE ACCESS
router.post(
  '/users/:id/courses/:courseId',
  run(async (req, res) => {
    const user = await findUser(req.params.id)
    const courseId = validId(req.params.courseId)
    if (!(await Course.exists({ _id: courseId }))) {
      throw fail('Course not found.', 404)
    }
    const filter = {
      userId: user._id,
      courseId,
    }
    try {
      await CourseEnrollment.updateOne(
        filter,
        {
          $setOnInsert: {
            ...filter,
            grantedBy: req.user._id,
            grantedAt: new Date(),
          },
        },
        {
          upsert: true,
          runValidators: true,
        },
      )
    } catch (error) {
      if (
        error.code !== 11000 ||
        !(await CourseEnrollment.exists(filter))
      ) {
        throw error
      }
    }
    res.json({
      message: 'Course access granted successfully.',
    })
  }),
)
// REMOVE COURSE ACCESS
router.delete(
  '/users/:id/courses/:courseId',
  run(async (req, res) => {
    const user = await findUser(req.params.id)
    const courseId = validId(req.params.courseId)
    await CourseEnrollment.deleteOne({
      userId: user._id,
      courseId,
    })
   // Payment records remain unchanged.
    res.json({
      message: 'Course access removed successfully.',
    })
  }),
)
// GRANT / UPDATE SIGNAL SUBSCRIPTION
router.patch(
  '/users/:id/signal-access',
  run(async (req, res) => {
    const user = await findUser(req.params.id)
    const body = jsonBody(req.body)
    if (Object.keys(body).some(key => key !== 'expiresAt')) {
      throw fail('Only expiresAt is allowed.')
    }
    if (
      typeof body.expiresAt !== 'string' ||
      !/(Z|[+-]\d{2}:\d{2})$/i.test(body.expiresAt)
    ) {
      throw fail('Send an ISO expiry date with a timezone.')
    }
    const expiry = new Date(body.expiresAt)
    if (
      !Number.isFinite(expiry.getTime()) ||
      expiry.getTime() <= Date.now()
    ) {
      throw fail('Subscription expiry must be in the future.')
    }
    const filter = {
      userId: user._id,
      signalId: null,
    }
    try {
      await SignalAccess.updateOne(
        filter,
        {
          $set: { expiresAt: expiry },
          $setOnInsert: filter,
        },
        {
          upsert: true,
          runValidators: true,
        },
      )
    } catch (error) {
      if (error.code !== 11000) throw error
      const result = await SignalAccess.updateOne(
        filter,
        { $set: { expiresAt: expiry } },
        { runValidators: true },
      )
      if (!result.matchedCount) throw error
    }
    res.json({
      message: 'Signal subscription saved successfully.',
      expiresAt: expiry,
    })
  }),
)
// REMOVE SIGNAL SUBSCRIPTION
router.delete(
  '/users/:id/signal-access',
  run(async (req, res) => {
    const user = await findUser(req.params.id)
   // Removes subscription to all signals.
   // Individual-signal purchases are retained.
    await SignalAccess.deleteOne({
      userId: user._id,
      signalId: null,
    })
    res.json({
      message: 'Signal subscription removed successfully.',
    })
  }),
)
// EDIT USER
router.patch('/users/:id', run(async (req, res) => {
  validId(req.params.id)
  if (req.params.id.toLowerCase() === String(req.user._id)) {
    throw fail(
      'Use your profile to change your own account.',
      403,
    )
  }
  const data = validateBody(req.body)
  const user = await findUser(req.params.id)
  if (
    user.googleId &&
    (
      (data.email !== undefined && data.email !== user.email) ||
      data.password !== undefined
    )
  ) {
    throw fail(
      'Google-linked email and password cannot be changed in this form.',
    )
  }
  const emailChanged =
    data.email !== undefined && data.email !== user.email
  if (emailChanged && data.emailVerified === undefined) {
    data.emailVerified = false
  }
  const finalRole = data.role ?? user.role
  const finalVerified = data.emailVerified ?? user.emailVerified
  if (
    user.role === 'admin' &&
    (finalRole !== 'admin' || !finalVerified)
  ) {
    throw fail(
      'Administrator accounts cannot be demoted or unverified here.',
      403,
    )
  }
  if (finalRole === 'admin' && !finalVerified) {
    throw fail('An admin account must be verified.')
  }
  const securityChanged =
    emailChanged ||
    data.password !== undefined ||
    finalRole !== user.role ||
    finalVerified !== user.emailVerified
  if (data.password !== undefined) {
    data.password = await bcrypt.hash(data.password, 12)
  }
  const update = { $set: data }
  if (securityChanged) {
    update.$inc = { authVersion: 1 }
    update.$unset = {
      emailCodeHash: '',
      emailCodeExpires: '',
      emailCodeAttempts: '',
      resetCodeHash: '',
      resetCodeExpires: '',
      resetCodeAttempts: '',
      resetTokenHash: '',
      resetTokenExpires: '',
    }
  }
  const version = user.authVersion ?? 0
  const updated = await User.findOneAndUpdate(
    {
      _id: user._id,
      role: user.role,
      email: user.email,
      emailVerified: user.emailVerified,
      $or: [
        { authVersion: version },
        ...(version === 0
          ? [{ authVersion: { $exists: false } }]
          : []),
      ],
    },
    update,
    {
      returnDocument: 'after',
      runValidators: true,
    },
  )
    .select(selection)
    .select('+googleId')
  if (!updated) {
    throw fail('The account changed. Refresh and try again.', 409)
  }
  res.json({
    message: securityChanged
      ? 'User updated. Previous sessions revoked.'
      : 'User updated.',
    user: safeUser(updated),
  })
}))
// DELETE ACCOUNT
router.delete('/users/:id', run(async (req, res) => {
  const user = await findUser(req.params.id)
  if (String(user._id) === String(req.user._id)) {
    throw fail('You cannot delete your own account.', 403)
  }
  if (user.role === 'admin') {
    throw fail('Administrator accounts cannot be deleted here.', 403)
  }
  const version = user.authVersion ?? 0
  const deleted = await User.findOneAndDelete({
    _id: user._id,
    role: user.role,
    $or: [
      { authVersion: version },
      ...(version === 0
        ? [{ authVersion: { $exists: false } }]
        : []),
    ],
  })
  if (!deleted) {
    throw fail('The account changed. Refresh and try again.', 409)
  }
 // Retain enrollment and payment history.
  res.json({ message: 'User deleted.' })
}))
// ROUTE ERRORS
router.use((error, req, res, next) => {
  if (res.headersSent) return next(error)
  if (error.code === 11000) {
    return res.status(409).json({
      message: 'Username, email or access record already exists.',
    })
  }
  if (
    error.name === 'ValidationError' ||
    error.name === 'CastError'
  ) {
    return res.status(400).json({
      message: error.message,
    })
  }
  if (error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({
      message: error.message,
    })
  }
  next(error)
})
export default router
