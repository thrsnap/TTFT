const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')

export async function getEconomicEvents() {
  if (!API_BASE) {
    throw new Error('Missing VITE_API_BASE_URL')
  }

  const response = await fetch(`${API_BASE}/api/economic-events`)

  if (!response.ok) {
    throw new Error('Could not load the economic calendar')
  }

  const data = await response.json()

  return data.events
}