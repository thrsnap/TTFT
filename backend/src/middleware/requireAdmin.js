import { timingSafeEqual } from 'node:crypto'

export default function requireAdmin(req, res, next) {
  const providedKey = req.get('x-admin-key')
  const expectedKey = process.env.ADMIN_API_KEY

  // Temporary debugging: does not print your secret key.
  console.log('Admin authorization check:', {
    requestHasKey: Boolean(providedKey),
    backendHasKey: Boolean(expectedKey),
    keysMatch: Boolean(
      providedKey && expectedKey && providedKey === expectedKey
    ),
  })

  if (!providedKey || !expectedKey) {
    return res.status(401).json({
      message: 'Unauthorized',
    })
  }

  const provided = Buffer.from(providedKey)
  const expected = Buffer.from(expectedKey)

  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return res.status(401).json({
      message: 'Unauthorized',
    })
  }

  next()
}