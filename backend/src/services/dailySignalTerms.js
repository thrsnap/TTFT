export const DAILY_PRODUCT_ID = 'daily-signal-monthly'
export const DAILY_AMOUNT_CENTS = 2500

// Calendar month in UTC; Jan 31 -> Feb 28/29, preserving time of day.
export function addCalendarMonth(value) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid subscription start date')
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + 1)
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(day, lastDay))
  return date
}
