export const NEWS_PRODUCT_ID = 'news-signal-monthly'
export const NEWS_AMOUNT_CENTS = 2500

// UTC calendar month with end-of-month clamping, preserving time of day.
// Jan 31 -> Feb 28 (Feb 29 in leap years), not a fixed 30-day duration.
export function addNewsCalendarMonth(value) {
  const start = new Date(value)
  if (!Number.isFinite(start.getTime())) throw new Error('Invalid subscription start date.')
  const end = new Date(start)
  const day = end.getUTCDate()
  end.setUTCDate(1)
  end.setUTCMonth(end.getUTCMonth() + 1)
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate()
  end.setUTCDate(Math.min(day, lastDay))
  return end
}

export function isNewsPaymentProduct(productId) {
  return productId === NEWS_PRODUCT_ID ||
    (typeof productId === 'string' && /^signal:[a-f0-9]{24}$/i.test(productId))
}
