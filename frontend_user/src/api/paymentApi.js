const BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:5000'
)
  .trim()
  .replace(/\/+$/, '')

async function request(path, body = {}) {
  let response

  try {
    response = await fetch(
      `${BASE_URL}/api/payments${path}`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-CMM-Request': '1',
        },
        body: JSON.stringify(body),

        // Longer than the backend's 15-second Bakong timeout.
        signal: AbortSignal.timeout(25000),
      },
    )
  } catch (cause) {
    const timedOut =
      cause.name === 'TimeoutError' ||
      cause.name === 'AbortError'

    throw new Error(
      timedOut
        ? 'Payment request timed out. Check the existing order before creating another.'
        : 'Cannot reach the backend. Check your connection and API URL.',
    )
  }

  const result = await response.json().catch(() => null)

  if (!response.ok) {
    const error = new Error(
      result?.message ||
      `Payment request failed (${response.status})`,
    )

    error.status = response.status
    throw error
  }

  if (
    result?.success !== true ||
    !result.data ||
    typeof result.data !== 'object'
  ) {
    throw new Error(
      'The backend returned an invalid payment response.',
    )
  }

  return result.data
}

export function createPayment(productId) {
  if (
    typeof productId !== 'string' ||
    !productId.trim()
  ) {
    return Promise.reject(
      new Error('Please select a valid product.'),
    )
  }

  return request('/orders', {
    productId: productId.trim(),
  })
}

export function checkPayment(orderId) {
  if (
    typeof orderId !== 'string' ||
    !/^[a-f0-9]{24}$/i.test(orderId)
  ) {
    return Promise.reject(
      new Error('Invalid payment order ID.'),
    )
  }

  return request(
    `/orders/${encodeURIComponent(orderId)}/check`,
  )
}