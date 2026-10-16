import mongoose from 'mongoose'
import axios from 'axios'

import {
  BakongKHQR,
  IndividualInfo,
  khqrData,
} from 'bakong-khqr'

import Payment from '../models/payment.model.js'
import Signal from '../models/signal.model.js'
import SignalAccess from '../models/signalAccess.model.js'

import {
  getSessionUserId,
} from '../services/signalAccess.service.js'

const PRODUCTS = {
  // Prices in cents: 2500 = $25.00
  'news-signal': {
    amountCents: 2500,
  },

  'course:6ac7c7c328016c1f9ed6927a': {
    amountCents: 10,
  },
}

const DAILY_LIMIT_MESSAGE =
  'Bakong’s daily verification request limit has been reached. ' +
  'Please try again tomorrow. This does not mean a payment was made.'

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

// Only a verified paid order can grant access.
async function fulfillSignalPayment(payment) {
  const signalId = signalIdFromProduct(payment.productId)

  if (!signalId || payment.status !== 'paid') {
    return {}
  }

  if (!(await Signal.exists({ _id: signalId }))) {
    return {
      signalId,
      accessGranted: false,
      signalDeleted: true,
    }
  }

  const filter = {
    userId: payment.userId,
    signalId,
  }

  try {
    await SignalAccess.updateOne(
      filter,
      {
        $setOnInsert: filter,
      },
      {
        upsert: true,
        runValidators: true,
      },
    )
  } catch (error) {
    if (
      error.code !== 11000 ||
      !(await SignalAccess.exists(filter))
    ) {
      throw error
    }
  }

  return {
    signalId,
    accessGranted: true,
    signalDeleted: false,
  }
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
  }
}

async function completedPaymentResult(payment) {
  return {
    ...paymentResult(payment),
    ...(await fulfillSignalPayment(payment)),
  }
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

function isDailyLimit(result) {
  return (
    result?.errorCode === 19 ||
    result?.errorCode === '19'
  )
}

function logVerificationError(error) {
  const response = error.response
  const data = response?.data

  // Never log the full Axios error or its request headers.
  console.error('Payment verification failed:', {
    time: new Date().toISOString(),
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

  if (isDailyLimit(error.response?.data)) {
    return DAILY_LIMIT_MESSAGE
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
  res.set('Cache-Control', 'private, no-store')

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

    if (productId === 'news-signal') {
      const selectedId = req.body?.signalId

      if (!mongoose.isObjectIdOrHexString(selectedId)) {
        return res.status(400).json({
          message: 'A valid signal ID is required',
        })
      }

      productId = `signal:${String(selectedId).toLowerCase()}`
    }

    const signalId = signalIdFromProduct(productId)
    let product

    if (signalId) {
      productId = `signal:${signalId.toLowerCase()}`

      if (!(await Signal.exists({ _id: signalId }))) {
        return res.status(404).json({
          message: 'This signal is no longer available',
        })
      }

      if (await SignalAccess.exists({ userId, signalId })) {
        return res.status(409).json({
          message:
            'You already have access to this signal. Return to News Signals.',
        })
      }

      product = {
        amountCents: PRODUCTS['news-signal'].amountCents,
      }
    } else if (
      productId.startsWith('course:') &&
      Object.hasOwn(PRODUCTS, productId)
    ) {
      product = PRODUCTS[productId]
    } else {
      return res.status(400).json({
        message:
          'Invalid product. Select a specific signal or course.',
      })
    }

    if (
      !Number.isSafeInteger(product.amountCents) ||
      product.amountCents <= 0
    ) {
      throw configurationError('Invalid configured product price')
    }

    const config = bakongConfig()

    if (signalId) {
      // Repair access from an existing verified receipt.
      const paidOrder = await Payment.findOne({
        userId,
        productId,
        status: 'paid',
      })

      if (paidOrder) {
        return res.json({
          success: true,
          data: {
            ...(await completedPaymentResult(paidOrder)),
            merchantName: config.name,
            qrCode: paidOrder.qrCode,
            verificationAvailable: Boolean(config.token),
          },
        })
      }

      // Reuse an unexpired order after a page refresh.
      const pendingOrder = await Payment.findOne({
        userId,
        productId,
        status: 'pending',
        recipientAccount: config.account,
        expiresAt: { $gt: new Date() },
      })

      if (pendingOrder) {
        return res.json({
          success: true,
          data: {
            ...paymentResult(pendingOrder),
            merchantName: config.name,
            qrCode: pendingOrder.qrCode,
            verificationAvailable: Boolean(config.token),
          },
        })
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
    console.error('Payment creation failed:', {
      code: error.code,
      message: safeText(error.message),
    })

    return res
      .status(error.code === 'PAYMENT_CONFIG_ERROR' ? 503 : 500)
      .json({
        message:
          error.code === 'PAYMENT_CONFIG_ERROR'
            ? error.message
            : 'Unable to create payment',
      })
  }
}

export async function checkPayment(req, res) {
  res.set('Cache-Control', 'private, no-store')

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

    // Already verified: no Bakong request is needed.
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

    // One log entry for each outgoing verification attempt.
    console.info('Bakong verification request:', {
      time: new Date().toISOString(),
      orderId: String(payment._id),
      userId,
      environment: config.environment,
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

    // A quota error must never mark an order paid or expired.
    if (isDailyLimit(result)) {
      console.warn('Bakong daily verification limit reached:', {
        time: new Date().toISOString(),
        orderId: String(payment._id),
        environment: config.environment,
        responseCode: result?.responseCode,
        errorCode: result?.errorCode,
      })

      return res.status(429).json({
        code: 'BAKONG_DAILY_LIMIT',
        message: DAILY_LIMIT_MESSAGE,
      })
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
          time: new Date().toISOString(),
          orderId: String(payment._id),
          responseCode: result?.responseCode,
          errorCode: result?.errorCode,
          responsePreview: safeText(result),
        })

        return res.status(502).json({
          message: 'Bakong could not verify this payment',
        })
      }

      // Expired orders can still be checked for a payment.
      // Only record expiry after a transaction-not-found result.
      if (Date.now() >= new Date(payment.expiresAt).getTime()) {
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

    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Duplicate payment reference; contact support',
      })
    }

    // Also handle error 19 if Bakong returns a non-2xx HTTP status.
    if (isDailyLimit(error.response?.data)) {
      return res.status(429).json({
        code: 'BAKONG_DAILY_LIMIT',
        message: DAILY_LIMIT_MESSAGE,
      })
    }

    return res
      .status(error.code === 'PAYMENT_CONFIG_ERROR' ? 503 : 502)
      .json({
        message: verificationErrorMessage(error),
      })
  }
}
