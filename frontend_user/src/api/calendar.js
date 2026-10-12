import axios from 'axios'

const BASE = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
)
  .trim()
  .replace(/\/+$/, '')

export async function getEconomicEvents({
  from,
  to,
  signal,
} = {}) {
  try {
    const response = await axios.get(`${BASE}/api/calendar`, {
      params: { from, to },
      signal,
    })

    if (!Array.isArray(response.data?.events)) {
      throw new Error('The backend did not return an events array.')
    }

    return response.data.events
  } catch (error) {
    if (axios.isCancel(error)) throw error

    const requestError = new Error(
      error.response?.data?.message ||
      error.message ||
      'Could not load the economic calendar',
    )

    requestError.status = error.response?.status
    throw requestError
  }
}