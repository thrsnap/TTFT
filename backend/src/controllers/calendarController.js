import axios from 'axios'

export async function getEconomicCalendar({
  from,
  to,
  signal,
}) {
  try {
    const response = await axios.get('/api/calendar', {
      params: {
        from,
        to,
      },
      signal,
    })

    return response.data.events ?? response.data
  } catch (error) {
    if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
      throw error
    }

    console.error('Economic calendar API error:', error)

    throw new Error(
      'Cannot reach the calendar server. Please retry shortly.'
    )
  }
}