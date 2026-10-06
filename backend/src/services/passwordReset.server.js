export async function sendPasswordResetEmail(email, code) {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.EMAIL_FROM?.trim()

  if (!apiKey || !from) {
    throw new Error(
      'Set RESEND_API_KEY and EMAIL_FROM in your backend .env.',
    )
  }

  console.log('Loaded EMAIL_FROM:', JSON.stringify(from))

  const senderAddress = from.includes('<')
    ? from.match(/^[^<>]+\s*<([^<>]+)>$/)?.[1]?.trim()
    : from

  if (
    !senderAddress ||
    !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(senderAddress) ||
    /[\r\n]/.test(from)
  ) {
    throw new Error(
      'Invalid EMAIL_FROM. Use noreply@cmm-ft.com or CMM-FT <noreply@cmm-ft.com>.',
    )
  }

  if (typeof email !== 'string' || !email.trim()) {
    throw new Error('Recipient email is required.')
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email.trim()],
      subject: 'CMM-FT password reset code',
      text:
        `Your password reset code is: ${code}\n\n` +
        'This code expires in 10 minutes.\n' +
        'If you did not request this, ignore this email.',
    }),
    signal: AbortSignal.timeout(15000),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    console.error('Resend password reset error:', {
      status: response.status,
      name: data.name,
      message: data.message,
    })

    throw new Error(
      `Reset email delivery failed (${response.status}).`,
    )
  }

  return data
}