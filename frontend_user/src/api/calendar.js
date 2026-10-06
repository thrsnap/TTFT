import axios from 'axios'

export async function getEconomicEvents({
  from,
  to,
  signal,
} = {}) {
  try {
    const response = await axios.get('/api/calendar', {
      params: {
        from,
        to,
      },
      signal,
    })

    return response.data.events ?? []
  } catch (error) {
    console.error('Economic API error:', error)
    console.error('Status:', error.response?.status)
    console.error('Response:', error.response?.data)

    throw new Error(
      error.response?.data?.message ||
      'Could not load the economic calendar'
    )
  }
}