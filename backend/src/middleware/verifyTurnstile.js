export default async function verifyTurnstile(req, res, next) {
  const token = req.body?.turnstileToken
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim()

  if (!secret) {
    return res.status(503).json({
      message: 'Login verification is not configured.',
    })
  }

  if (
    typeof token !== 'string' ||
    !token.trim() ||
    token.length > 2048
  ) {
    return res.status(400).json({
      message: 'Complete the security verification before logging in.',
    })
  }

  try {
    const allowedHostnames = [
      process.env.FRONTEND_URL,
      process.env.ADMIN_FRONTEND_URL,
    ]
      .filter(Boolean)
      .map(value => new URL(value.trim()).hostname)

    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          secret,
          response: token,
        }),
        signal: AbortSignal.timeout(10000),
      },
    )

    if (!response.ok) {
      throw new Error('Verification service unavailable')
    }

    const result = await response.json()

    if (
      result.success !== true ||
      result.action !== 'login' ||
      !allowedHostnames.includes(result.hostname)
    ) {
      return res.status(403).json({
        message: 'Security verification failed. Please try again.',
      })
    }

    return next()
  } catch {
    return res.status(503).json({
      message: 'Security verification is unavailable. Please try again.',
    })
  }
}