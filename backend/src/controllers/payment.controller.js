import mongoose from 'mongoose'
import axios from 'axios'
import {
  BakongKHQR,
  IndividualInfo,
  khqrData,
} from 'bakong-khqr'
import Payment from '../models/payment.model.js'
import Signal from '../models/signal.model.js'
import { NEWS_PRODUCT_ID, NEWS_AMOUNT_CENTS } from '../services/newsSignalTerms.js'
import { getNewsSubscription, fulfillNewsPayment } from '../services/newsSignalAccess.service.js'
import { DAILY_PRODUCT_ID, DAILY_AMOUNT_CENTS } from '../services/dailySignalTerms.js'
import { getDailySubscription, fulfillDailyPayment } from '../services/dailySignalAccess.service.js'
import { courseIdFromProduct, resolveCourseProduct, fulfillCoursePayment } from '../services/coursePayment.service.js'
const DAILY_LIMIT_MESSAGE = 'Bakong’s daily verification request limit has been reached. Please try again after the quota resets. If you already paid, do not pay again.'
function isDailyLimit(result) { return String(result?.errorCode) === '19' }
// Bakong has reported that the daily verification quota is exhausted.
// Cache this result until the next Cambodia calendar day to avoid repeatedly
// calling Bakong while the quota is unavailable. This cache is process-local;
// use a shared store (for example Redis) if the app runs multiple instances.
let bakongDailyLimitUntil = 0
function nextCambodiaMidnightMs() {
  const now = new Date()
  const cambodiaNow = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  return Date.UTC(
    cambodiaNow.getUTCFullYear(),
    cambodiaNow.getUTCMonth(),
    cambodiaNow.getUTCDate() + 1,
    -7,
    0,
    0,
  )
}
function markBakongDailyLimit() {
  bakongDailyLimitUntil = Math.max(bakongDailyLimitUntil, nextCambodiaMidnightMs())
}
function bakongDailyLimitResponse(res) {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((bakongDailyLimitUntil - Date.now()) / 1000),
  )
  return res
    .set('Retry-After', String(retryAfterSeconds))
    .status(429)
    .json({ code: 'BAKONG_DAILY_LIMIT', message: DAILY_LIMIT_MESSAGE })
}
import {
  getSessionUserId,
} from '../services/signalAccess.service.js'
async function currentUserId(req) {
  const userId = await getSessionUserId(req)
  return userId ? String(userId) : null
}
function signalIdFromProduct(productId) {
  if (
    typeof productId !== 'string' ||
    !productId.startsWith('signal:')
  ) {
    return null
  }
  const id = productId.slice('signal:'.length)
  return mongoose.isObjectIdOrHexString(id) ? id : null
}
function configurationError(message) {
  const error = new Error(message)
  error.code = 'PAYMENT_CONFIG_ERROR'
  return error
}
function paymentResult(payment) {
  return {
    orderId: String(payment._id),
    productId: payment.productId,
    signalId: signalIdFromProduct(payment.productId),
    status: payment.status,
    amount: (payment.amountCents / 100).toFixed(2),
    currency: payment.currency,
    expiresAt: payment.expiresAt,
    paidAt: payment.paidAt ?? null,
    ...(courseIdFromProduct(payment.productId) ? {
      courseId: courseIdFromProduct(payment.productId),
      courseTitle: payment.courseTitle || null,
    } : {}),
  }
}
async function completedPaymentResult(payment) {
  if (!courseIdFromProduct(payment.productId)) {
    return {
      ...paymentResult(payment),
      ...await fulfillNewsPayment(payment),
      ...await fulfillDailyPayment(payment),
    }
  }
  const result = paymentResult(payment)
  try {
    Object.assign(result, await fulfillCoursePayment(payment))
  } catch (error) {
    if (payment.status !== 'paid' || !courseIdFromProduct(payment.productId)) throw error
    // The verified receipt is durable even if access creation needs a retry.
    console.error('Course access fulfillment failed:', { orderId: String(payment._id), code: error.code })
    Object.assign(result, { courseId: courseIdFromProduct(payment.productId), accessGranted: false, fulfillmentPending: true })
  }
  return result
}
function bakongConfig({ requireToken = false } = {}) {
  const environment = process.env.BAKONG_ENV?.trim()
  if (!['production', 'development'].includes(environment)) {
    throw configurationError(
      'Set BAKONG_ENV to production or development',
    )
  }
  const baseURL =
    environment === 'production'
      ? 'https://api-bakong.nbc.gov.kh/v1'
      : 'https://sit-api-bakong.nbc.gov.kh/v1'
  const account = process.env.BAKONG_ACCOUNT_USERNAME?.trim()
  const name = process.env.BAKONG_ACCOUNT_NAME?.trim()
  const token = process.env.BAKONG_ACCESS_TOKEN?.trim() || ''
  if (!account || !name) {
    throw configurationError(
      'Missing BAKONG_ACCOUNT_USERNAME or BAKONG_ACCOUNT_NAME',
    )
  }
  if (requireToken) {
    if (!token) {
      throw configurationError('Missing BAKONG_ACCESS_TOKEN')
    }
    if (/^Bearer\s/i.test(token)) {
      throw configurationError(
        'Remove the Bearer prefix from BAKONG_ACCESS_TOKEN',
      )
    }
  }
  return {
    environment,
    baseURL,
    account,
    name,
    token,
  }
}
function usdCents(value) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value))
  if (!match) return null
  const cents =
    Number(match[1]) * 100 +
    Number((match[2] ?? '').padEnd(2, '0'))
  return Number.isSafeInteger(cents) ? cents : null
}
function safeText(value) {
  let text
  try {
    text =
      typeof value === 'string'
        ? value
        : JSON.stringify(value ?? null)
  } catch {
    text = '[Unreadable response]'
  }
  const token = process.env.BAKONG_ACCESS_TOKEN?.trim()
  if (token) {
    text = text.split(token).join('[REDACTED]')
  }
  return text
    .replace(
      /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      '[REDACTED]',
    )
    .slice(0, 800)
}
function logVerificationError(error) {
  const response = error.response
  const data = response?.data
  // Never log the full Axios error or request headers.
  console.error('Payment verification failed:', {
    code: error.code,
    httpStatus: response?.status,
    contentType: response?.headers?.['content-type'],
    server: response?.headers?.server,
    cloudFrontRequestId: response?.headers?.['x-amz-cf-id'],
    cloudFrontPop: response?.headers?.['x-amz-cf-pop'],
    responseCode: data?.responseCode,
    errorCode: data?.errorCode,
    responsePreview: safeText(data),
    localError: axios.isAxiosError(error)
      ? undefined
      : safeText(error.message),
  })
}
function verificationErrorMessage(error) {
  if (error.code === 'PAYMENT_CONFIG_ERROR') {
    return error.message
  }
  const status = error.response?.status
  const contentType = String(
    error.response?.headers?.['content-type'] ?? '',
  ).toLowerCase()
  const server = String(
    error.response?.headers?.server ?? '',
  ).toLowerCase()
  if (
    status === 403 &&
    contentType.includes('text/html') &&
    server.includes('cloudfront')
  ) {
    return (
      'The verification request was blocked by CloudFront. ' +
      'Contact Bakong API support with the request ID ' +
      'from your backend logs.'
    )
  }
  if (status === 401 || status === 403) {
    return (
      `Bakong returned HTTP ${status}. ` +
      'Confirm the token environment and check the backend logs.'
    )
  }
  if (status === 404) {
    return 'Bakong verification endpoint was not found.'
  }
  if (status === 429) {
    return 'Too many verification requests. Wait and try again.'
  }
  if (
    error.code === 'ECONNABORTED' ||
    error.code === 'ETIMEDOUT'
  ) {
    return 'Bakong verification timed out. Please try again.'
  }
  if (
    error.code === 'ENOTFOUND' ||
    error.code === 'EAI_AGAIN'
  ) {
    return 'The backend could not resolve the Bakong API hostname.'
  }
  return 'Unable to verify payment. Please try again.'
}
export async function createPayment(req, res) {
  try {
    const userId = await currentUserId(req)
    if (!userId) {
      return res.status(401).json({
        message: 'Please log in first',
      })
    }
    let productId = req.body?.productId
    if (typeof productId !== 'string') {
      return res.status(400).json({
        message: 'Invalid product',
      })
    }
    productId = productId.trim()
    // Accept old frontend links but create the monthly News product.
    const legacySignalId = signalIdFromProduct(productId)
    if (legacySignalId) {
      if (!(await Signal.exists({ _id: legacySignalId, archivedAt: null }))) {
        return res.status(404).json({ message: 'This signal is no longer active. Open the News subscription plan.' })
      }
      productId = NEWS_PRODUCT_ID
    } else if (productId === 'news-signal') {
      productId = NEWS_PRODUCT_ID
    }
    let product
    if (productId === NEWS_PRODUCT_ID) {
      // Repair a paid receipt before offering another QR; never reset paidAt.
      const paidOrder = await Payment.findOne({
        userId, status: 'paid', paidAt: { $ne: null },
        $or: [
          { productId: NEWS_PRODUCT_ID },
          { productId: { $regex: '^signal:[a-fA-F0-9]{24}$' } },
        ],
      }).sort({ paidAt: -1 })
      if (paidOrder) await fulfillNewsPayment(paidOrder)
      const subscription = await getNewsSubscription(userId)
      if (subscription.active) {
        return res.status(409).json({ message: 'Your News Signal subscription is already active.', subscription })
      }
      product = { amountCents: NEWS_AMOUNT_CENTS }
    } else if (productId === DAILY_PRODUCT_ID) {
      const subscription = await getDailySubscription(userId)
      if (subscription.active) {
        return res.status(409).json({ message: 'Your Daily Signal subscription is already active.' })
      }
      product = { amountCents: DAILY_AMOUNT_CENTS }
    } else if (/^course:/i.test(productId)) {
      product = await resolveCourseProduct(userId, productId)
      productId = `course:${product.courseId}`
      // Repair a previously verified receipt before offering another payment.
      const paidOrder = await Payment.findOne({
        userId, productId,
        status: 'paid', paidAt: { $ne: null },
      }).sort({ paidAt: -1 })
      if (paidOrder) {
        return res.json({ success: true, data: await completedPaymentResult(paidOrder) })
      }
    } else {
      return res.status(400).json({ message: 'Invalid product. Select a subscription or course.' })
    }
    if (
      !Number.isSafeInteger(product.amountCents) ||
      product.amountCents <= 0
    ) {
      throw configurationError(
        'Invalid configured product price',
      )
    }
    const config = bakongConfig({ requireToken: Boolean(product.courseId) })
    if (productId === NEWS_PRODUCT_ID || productId === DAILY_PRODUCT_ID || product.courseId) {
      const pendingOrder = await Payment.findOne({
        userId,
        ...(productId === NEWS_PRODUCT_ID ? {
          $or: [
            { productId: NEWS_PRODUCT_ID },
            { productId: { $regex: '^signal:[a-fA-F0-9]{24}$' } },
          ],
        } : { productId }),
        ...(product.courseId ? { courseId: product.courseId } : {}),
        status: 'pending', recipientAccount: config.account,
        amountCents: product.amountCents, expiresAt: { $gt: new Date() },
      }).sort({ createdAt: -1 })
      if (pendingOrder) {
        return res.json({ success: true, data: {
          ...paymentResult(pendingOrder), merchantName: config.name,
          qrCode: pendingOrder.qrCode, verificationAvailable: Boolean(config.token),
        } })
      }
    }
    const orderId = new mongoose.Types.ObjectId()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
    const info = new IndividualInfo(
      config.account,
      config.name,
      'PHNOM PENH',
      {
        currency: khqrData.currency.usd,
        amount: product.amountCents / 100,
        billNumber: String(orderId),
        expirationTimestamp: expiresAt.getTime(),
      },
    )
    const result = new BakongKHQR().generateIndividual(info)
    if (
      result?.status?.code !== 0 ||
      !result?.data?.qr ||
      !result?.data?.md5
    ) {
      throw new Error('KHQR generation failed')
    }
    const payment = await Payment.create({
      _id: orderId,
      userId,
      productId,
      ...(product.courseId ? { courseId: product.courseId, courseTitle: product.courseTitle } : {}),
      amountCents: product.amountCents,
      currency: 'USD',
      recipientAccount: config.account,
      status: 'pending',
      qrCode: result.data.qr,
      qrMd5: result.data.md5,
      expiresAt,
    })
    return res.status(201).json({
      success: true,
      data: {
        ...paymentResult(payment),
        merchantName: config.name,
        qrCode: payment.qrCode,
        verificationAvailable: Boolean(config.token),
      },
    })
  } catch (error) {
    if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
      return res.status(error.status).json({ message: error.message, code: error.code })
    }
    console.error('Payment creation failed:', {
      code: error.code,
      message: safeText(error.message),
    })
    return res
      .status(
        error.code === 'PAYMENT_CONFIG_ERROR' ? 503 : 500,
      )
      .json({
        message:
          error.code === 'PAYMENT_CONFIG_ERROR'
            ? error.message
            : 'Unable to create payment',
      })
  }
}
export async function checkPayment(req, res) {
  try {
    const userId = await currentUserId(req)
    if (!userId) {
      return res.status(401).json({
        message: 'Please log in first',
      })
    }
    const { orderId } = req.params
    if (!mongoose.isObjectIdOrHexString(orderId)) {
      return res.status(400).json({
        message: 'Invalid order ID',
      })
    }
    let payment = await Payment.findOne({
      _id: orderId,
      userId,
    })
    if (!payment) {
      return res.status(404).json({
        message: 'Payment not found',
      })
    }
    if (payment.status === 'paid') {
      return res.json({
        success: true,
        data: await completedPaymentResult(payment),
      })
    }
    if (!/^[a-f0-9]{32}$/i.test(payment.qrMd5 ?? '')) {
      return res.status(409).json({
        message: 'This order has an invalid saved QR hash',
      })
    }
    const config = bakongConfig({
      requireToken: true,
    })
    if (Date.now() < bakongDailyLimitUntil) {
      return bakongDailyLimitResponse(res)
    }
console.info('Bakong verification request:', {
      time: new Date().toISOString(), orderId: String(payment._id),
      userId, environment: config.environment,
    })
    const response = await axios.post(
      `${config.baseURL}/check_transaction_by_md5`,
      {
        md5: payment.qrMd5,
      },
      {
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 15000,
        maxRedirects: 0,
      },
    )
    const result = response.data
    const transaction = result?.data
    if (isDailyLimit(result)) {
      console.warn('Bakong verification rejected:', {
  orderId: String(payment._id),
  httpStatus: response.status,
  responseCode: result?.responseCode,
  errorCode: result?.errorCode,
  responseMessage: safeText(result?.responseMessage),
})
      markBakongDailyLimit()
      return bakongDailyLimitResponse(res)
    }
    if (result?.responseCode === 0) {
      if (
        typeof transaction?.hash !== 'string' ||
        !transaction.hash.trim()
      ) {
        console.error('Invalid Bakong success response:', {
          responsePreview: safeText(result),
        })
        return res.status(502).json({
          message: 'Bakong returned an incomplete transaction',
        })
      }
      const matches =
        transaction.toAccountId === payment.recipientAccount &&
        transaction.currency === payment.currency &&
        usdCents(transaction.amount) === payment.amountCents
      if (!matches) {
        return res.status(409).json({
          message: 'Payment details do not match this order',
        })
      }
      await Payment.updateOne(
        {
          _id: payment._id,
          userId,
          status: { $ne: 'paid' },
        },
        {
          $set: {
            status: 'paid',
            transactionHash: transaction.hash,
            paidAt: new Date(),
          },
        },
        {
          runValidators: true,
        },
      )
    } else {
      const notFound =
        result?.responseCode === 1 &&
        (
          result?.errorCode === 1 ||
          /transaction.*(?:could not be found|not found)/i.test(
            String(result?.responseMessage ?? ''),
          )
        )
      if (!notFound) {
        console.error('Bakong verification rejected:', {
          responseCode: result?.responseCode,
          errorCode: result?.errorCode,
          responsePreview: safeText(result),
        })
        return res.status(502).json({
          message: 'Bakong could not verify this payment',
        })
      }
      // Check Bakong before recording expiry.
      // An expired order can still be checked manually.
      if (
        Date.now() >= new Date(payment.expiresAt).getTime()
      ) {
        await Payment.updateOne(
          {
            _id: payment._id,
            userId,
            status: 'pending',
          },
          {
            $set: {
              status: 'expired',
            },
          },
        )
      }
    }
    payment = await Payment.findOne({
      _id: orderId,
      userId,
    })
    if (!payment) {
      return res.status(404).json({
        message: 'Payment not found',
      })
    }
    return res.json({
      success: true,
      data: await completedPaymentResult(payment),
    })
  } catch (error) {
    logVerificationError(error)
    if (isDailyLimit(error.response?.data)) {
      markBakongDailyLimit()
      return bakongDailyLimitResponse(res)
    }
    if (error.code === 11000) {
      return res.status(409).json({
        message:
          'Duplicate payment reference; contact support',
      })
    }
    return res
      .status(
        error.code === 'PAYMENT_CONFIG_ERROR' ? 503 : 502,
      )
      .json({
        message: verificationErrorMessage(error),
      })
  }
}
