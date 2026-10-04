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
    if (
      error.name === 'CanceledError' ||
      error.code === 'ERR_CANCELED'
    ) {
      throw error
    }

    console.error(
      'Economic calendar API error:',
      error
    )

    throw new Error(
      'Could not load the economic calendar'
    )
  }
}