export async function sendVerificationEmail(email, code) {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.EMAIL_FROM?.trim()

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is missing from backend environment.')
  }

  if (!from) {
    throw new Error('EMAIL_FROM is missing from backend environment.')
  }

  if (typeof email !== 'string' || !email.trim()) {
    throw new Error('A recipient email is required.')
  }

  if (code === undefined || code === null || String(code).trim() === '') {
    throw new Error('A verification code is required.')
  }

  let response

  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',

      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        from,
        to: [email.trim()],
        subject: 'Your CMM-FT verification code',
        text:
          `Your verification code is ${code}.\n\n` +
          'This code expires in 10 minutes.\n' +
          'If you did not request it, ignore this email.',
      }),

      signal: AbortSignal.timeout(15000),
    })
  } catch (error) {
    console.error('Email request failed:', {
      name: error.name,
      message: error.message,
    })

    throw new Error('Unable to reach the email service. Please try again.')
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    console.error('Email delivery failed:', {
      status: response.status,
      name: data.name,
      message: data.message,
    })

    throw new Error('Unable to send verification email. Please try again.')
  }

  return data
}