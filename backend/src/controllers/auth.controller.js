import bcrypt from 'bcryptjs'
import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto'
import { OAuth2Client } from 'google-auth-library'

import User from '../models/user.model.js'
import { sendVerificationEmail } from '../services/email.server.js'
import { sendPasswordResetEmail } from '../services/passwordReset.server.js'

const googleClient = new OAuth2Client()

const normalize = value =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

const validEmail = email =>
  email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

function safeUser(user) {
  return {
    id: String(user._id),
    username: user.username,
    email: user.email,
    emailVerified: user.emailVerified,
  }
}

function hashCode(userId, code) {
  return createHmac('sha256', process.env.OTP_SECRET)
    .update(`${userId}:${code}`)
    .digest('hex')
}

function hashResetValue(purpose, value) {
  return createHmac('sha256', process.env.OTP_SECRET)
    .update(`password-reset:${purpose}:${value}`)
    .digest('hex')
}

async function startSession(req, user) {
  await new Promise((resolve, reject) => {
    req.session.regenerate(error => {
      if (error) reject(error)
      else resolve()
    })
  })

  req.session.userId = String(user._id)
  req.session.authVersion = user.authVersion ?? 0

  await new Promise((resolve, reject) => {
    req.session.save(error => {
      if (error) reject(error)
      else resolve()
    })
  })
}

async function issueCode(user) {
  const code = String(randomInt(0, 1000000)).padStart(6, '0')

  const updated = await User.findOneAndUpdate(
    {
      _id: user._id,
      emailVerified: false,
      $or: [
        { emailCodeSentAt: { $lte: new Date(Date.now() - 60000) } },
        { emailCodeSentAt: { $exists: false } },
      ],
    },
    {
      $set: {
        emailCodeHash: hashCode(user._id, code),
        emailCodeExpires: new Date(Date.now() + 10 * 60 * 1000),
        emailCodeAttempts: 0,
        emailCodeSentAt: new Date(),
      },
    },
    { returnDocument: 'after' },
  )

  if (!updated) {
    const error = new Error(
      'Wait 60 seconds before requesting another code.',
    )
    error.status = 429
    throw error
  }

  await sendVerificationEmail(user.email, code)
}

// REGISTER
export async function registerUser(req, res) {
  const username = normalize(req.body?.username)
  const email = normalize(req.body?.email)
  const password = req.body?.password

  if (
    !/^[a-z0-9_]{3,30}$/.test(username) ||
    !validEmail(email) ||
    typeof password !== 'string' ||
    password.length < 12 ||
    Buffer.byteLength(password) > 72
  ) {
    return res.status(400).json({
      message:
        'Use a valid email, a username with 3–30 letters/numbers/underscores, ' +
        'and a password of at least 12 characters and at most 72 UTF-8 bytes.',
    })
  }

  const existing = await User.exists({
    $or: [{ email }, { username }],
  })

  if (existing) {
    return res.status(409).json({
      message:
        'Email or username already registered. Log in or resend verification.',
    })
  }

  const user = await User.create({
    username,
    email,
    password: await bcrypt.hash(password, 12),
    emailVerified: false,
  })

  let emailSent = true

  try {
    await issueCode(user)
  } catch {
    emailSent = false
  }

  return res.status(201).json({
    verificationRequired: true,
    email: user.email,
    emailSent,
    message: emailSent
      ? 'Check your email for the verification code.'
      : 'Account created, but email delivery failed. Check email settings, then resend after 60 seconds.',
  })
}

// VERIFY REGISTRATION EMAIL
export async function verifyEmail(req, res) {
  const email = normalize(req.body?.email)
  const code =
    typeof req.body?.code === 'string' ? req.body.code.trim() : ''

  if (!validEmail(email) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({
      message: 'Enter your email and six-digit code.',
    })
  }

  const user = await User.findOneAndUpdate(
    {
      email,
      emailVerified: false,
      emailCodeExpires: { $gt: new Date() },
      emailCodeAttempts: { $lt: 5 },
    },
    { $inc: { emailCodeAttempts: 1 } },
    { returnDocument: 'after' },
  ).select('+emailCodeHash')

  if (!user?.emailCodeHash) {
    return res.status(400).json({
      message: 'Code expired or attempt limit reached. Request a new code.',
    })
  }

  const supplied = Buffer.from(hashCode(user._id, code), 'hex')
  const stored = Buffer.from(user.emailCodeHash, 'hex')

  if (
    supplied.length !== stored.length ||
    !timingSafeEqual(supplied, stored)
  ) {
    return res.status(400).json({
      message: 'Incorrect verification code.',
    })
  }

  const verified = await User.findOneAndUpdate(
    {
      _id: user._id,
      emailVerified: false,
      emailCodeHash: user.emailCodeHash,
      emailCodeAttempts: { $lte: 5 },
      emailCodeExpires: { $gt: new Date() },
    },
    {
      $set: { emailVerified: true },
      $unset: {
        emailCodeHash: '',
        emailCodeExpires: '',
        emailCodeAttempts: '',
      },
    },
    { returnDocument: 'after' },
  )

  if (!verified) {
    return res.status(400).json({
      message: 'Code already used or replaced. Log in or request a new code.',
    })
  }

  await startSession(req, verified)

  return res.json({
    message: 'Email verified.',
    user: safeUser(verified),
  })
}

// RESEND REGISTRATION CODE
export async function resendVerification(req, res) {
  const email = normalize(req.body?.email)

  if (!validEmail(email)) {
    return res.status(400).json({
      message: 'Enter a valid email.',
    })
  }

  const user = await User.findOne({
    email,
    emailVerified: false,
  })

  if (user) await issueCode(user)

  return res.json({
    message:
      'If this email belongs to a pending account, a new code has been sent.',
  })
}

// EMAIL/PASSWORD LOGIN
export async function loginUser(req, res) {
  const identifier = normalize(req.body?.identifier)
  const password = req.body?.password

  if (
    !identifier ||
    identifier.length > 254 ||
    typeof password !== 'string' ||
    Buffer.byteLength(password) > 72
  ) {
    return res.status(400).json({
      message: 'Enter email or username and password.',
    })
  }

  const user = await User.findOne({
    $or: [{ email: identifier }, { username: identifier }],
  }).select('+password')

  if (
    !user ||
    !user.password ||
    !(await bcrypt.compare(password, user.password))
  ) {
    return res.status(401).json({
      message: 'Invalid login details.',
    })
  }

  if (!user.emailVerified) {
    return res.status(403).json({
      verificationRequired: true,
      email: user.email,
      message: 'Verify your email before logging in.',
    })
  }

  await startSession(req, user)

  return res.json({
    user: safeUser(user),
  })
}

// GOOGLE LOGIN
export async function googleLogin(req, res, next) {
  const credential = req.body?.credential
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()

  if (typeof credential !== 'string' || !credential.trim()) {
    return res.status(400).json({
      message: 'Google sign-in token is required.',
    })
  }

  if (!clientId) {
    return res.status(500).json({
      message: 'Google login is not configured on the server.',
    })
  }

  let googleUser

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: clientId,
    })

    googleUser = ticket.getPayload()
  } catch {
    return res.status(401).json({
      message: 'Invalid or expired Google sign-in token.',
    })
  }

  if (
    !googleUser?.sub ||
    !googleUser.email ||
    googleUser.email_verified !== true
  ) {
    return res.status(401).json({
      message: 'A verified Google email is required.',
    })
  }

  try {
    let user = await User.findOne({
      googleId: googleUser.sub,
    })

    if (!user) {
      const email = normalize(googleUser.email)

      if (!validEmail(email)) {
        return res.status(400).json({
          message: 'Google returned an unsupported email address.',
        })
      }

      const existing = await User.exists({ email })

      if (existing) {
        return res.status(409).json({
          message:
            'This email already has an account. Log in with your password. ' +
            'Google account linking must be completed separately.',
        })
      }

      const usernameBase =
        email
          .split('@')[0]
          .replace(/[^a-z0-9_]/g, '')
          .slice(0, 16) || 'user'

      const username =
        `${usernameBase}_${randomBytes(6).toString('hex')}`

      user = await User.create({
        username,
        email,
        googleId: googleUser.sub,
        emailVerified: true,
      })
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        message: 'Verify your website account before logging in.',
      })
    }

    await startSession(req, user)

    res.set('Cache-Control', 'no-store')

    return res.json({
      message: 'Google login successful.',
      user: safeUser(user),
    })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message:
          'An account was created at the same time. Please try logging in again.',
      })
    }

    return next(error)
  }
}

// STEP 1: SEND PASSWORD RESET CODE
export async function forgotPassword(req, res, next) {
  const email = normalize(req.body?.email)

  if (!validEmail(email)) {
    return res.status(400).json({
      message: 'Enter a valid email address.',
    })
  }

  try {
    const code = String(randomInt(0, 1000000)).padStart(6, '0')

    const user = await User.findOneAndUpdate(
      {
        email,
        emailVerified: true,
        password: { $type: 'string' },
        $or: [
          { resetCodeSentAt: { $lte: new Date(Date.now() - 60000) } },
          { resetCodeSentAt: { $exists: false } },
        ],
      },
      {
        $set: {
          resetCodeHash: hashResetValue('code', `${email}:${code}`),
          resetCodeExpires: new Date(Date.now() + 10 * 60 * 1000),
          resetCodeAttempts: 0,
          resetCodeSentAt: new Date(),
        },
        $unset: {
          resetTokenHash: '',
          resetTokenExpires: '',
        },
      },
      { returnDocument: 'after' },
    )

    if (user) {
      try {
        await sendPasswordResetEmail(user.email, code)
      } catch (error) {
        console.error('Password reset email failed:', error.message)
      }
    }

    res.set('Cache-Control', 'no-store')

    return res.json({
      message:
        'If this email has a verified password account, a reset code will be sent. ' +
        'Check your inbox and spam folder. Wait 60 seconds before resending.',
    })
  } catch (error) {
    return next(error)
  }
}

// STEP 2: VERIFY PASSWORD RESET CODE
export async function verifyResetCode(req, res, next) {
  const email = normalize(req.body?.email)
  const code =
    typeof req.body?.code === 'string' ? req.body.code.trim() : ''

  if (!validEmail(email) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({
      message: 'Enter your email and six-digit code.',
    })
  }

  try {
    const user = await User.findOneAndUpdate(
      {
        email,
        emailVerified: true,
        resetCodeHash: { $exists: true },
        resetCodeExpires: { $gt: new Date() },
        resetCodeAttempts: { $lt: 5 },
      },
      { $inc: { resetCodeAttempts: 1 } },
      { returnDocument: 'after' },
    ).select('+resetCodeHash')

    if (!user?.resetCodeHash) {
      return res.status(400).json({
        message:
          'Code expired, already used, or attempt limit reached. Request a new code.',
      })
    }

    const supplied = Buffer.from(
      hashResetValue('code', `${email}:${code}`),
      'hex',
    )
    const stored = Buffer.from(user.resetCodeHash, 'hex')

    if (
      supplied.length !== stored.length ||
      !timingSafeEqual(supplied, stored)
    ) {
      return res.status(400).json({
        message: 'Incorrect reset code.',
      })
    }

    const resetToken = randomBytes(32).toString('hex')

    const verified = await User.findOneAndUpdate(
      {
        _id: user._id,
        resetCodeHash: user.resetCodeHash,
        resetCodeExpires: { $gt: new Date() },
        resetCodeAttempts: { $lte: 5 },
      },
      {
        $set: {
          resetTokenHash: hashResetValue('token', resetToken),
          resetTokenExpires: new Date(Date.now() + 10 * 60 * 1000),
        },
        $unset: {
          resetCodeHash: '',
          resetCodeExpires: '',
          resetCodeAttempts: '',
        },
      },
      { returnDocument: 'after' },
    )

    if (!verified) {
      return res.status(400).json({
        message: 'Code already used or replaced. Request a new code.',
      })
    }

    res.set('Cache-Control', 'no-store')

    return res.json({
      message: 'Code verified. Set your new password.',
      resetToken,
    })
  } catch (error) {
    return next(error)
  }
}

// STEP 3: SAVE NEW PASSWORD
export async function resetPassword(req, res, next) {
  const resetToken = req.body?.resetToken
  const password = req.body?.password
  const confirmPassword = req.body?.confirmPassword

  if (
    typeof resetToken !== 'string' ||
    !/^[a-f0-9]{64}$/.test(resetToken)
  ) {
    return res.status(400).json({
      message: 'Invalid reset token. Request a new code.',
    })
  }

  if (
    typeof password !== 'string' ||
    password.length < 12 ||
    Buffer.byteLength(password, 'utf8') > 72
  ) {
    return res.status(400).json({
      message: 'Use at least 12 characters and at most 72 UTF-8 bytes.',
    })
  }

  if (password !== confirmPassword) {
    return res.status(400).json({
      message: 'Passwords do not match.',
    })
  }

  try {
    const tokenHash = hashResetValue('token', resetToken)

    const eligible = await User.exists({
      resetTokenHash: tokenHash,
      resetTokenExpires: { $gt: new Date() },
      emailVerified: true,
    })

    if (!eligible) {
      return res.status(400).json({
        message: 'Reset token expired or already used. Request a new code.',
      })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const updated = await User.findOneAndUpdate(
      {
        resetTokenHash: tokenHash,
        resetTokenExpires: { $gt: new Date() },
        emailVerified: true,
      },
      {
        $set: {
          password: passwordHash,
        },
        $inc: {
          authVersion: 1,
        },
        $unset: {
          resetTokenHash: '',
          resetTokenExpires: '',
          resetCodeHash: '',
          resetCodeExpires: '',
          resetCodeAttempts: '',
        },
      },
      { returnDocument: 'after' },
    )

    if (!updated) {
      return res.status(400).json({
        message: 'Reset token expired or already used. Request a new code.',
      })
    }

    res.set('Cache-Control', 'no-store')

    return res.json({
      message: 'Password updated. Log in with your new password.',
    })
  } catch (error) {
    return next(error)
  }
}

// CURRENT USER
export async function getCurrentUser(req, res) {
  const user = req.session.userId
    ? await User.findById(req.session.userId)
    : null

  if (
    !user?.emailVerified ||
    (req.session.authVersion ?? 0) !== (user.authVersion ?? 0)
  ) {
    return res.status(401).json({
      message: 'Please log in.',
    })
  }

  res.set('Cache-Control', 'no-store')

  return res.json({
    user: safeUser(user),
  })
}

// LOGOUT
export async function logoutUser(req, res) {
  await new Promise((resolve, reject) => {
    req.session.destroy(error => {
      if (error) reject(error)
      else resolve()
    })
  })

  res.clearCookie('cmm.sid', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.COOKIE_SAME_SITE || 'lax',
  })

  return res.json({
    message: 'Logged out.',
  })
}

// PROTECT AUTHENTICATED ROUTES
export async function requireUser(req, res, next) {
  const user = req.session.userId
    ? await User.findById(req.session.userId)
    : null

  if (
    !user?.emailVerified ||
    (req.session.authVersion ?? 0) !== (user.authVersion ?? 0)
  ) {
    return res.status(401).json({
      message: 'Please log in.',
    })
  }

  req.user = user
  next()
}