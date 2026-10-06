const API_URL =
  'https://cryptocurrency.cv/api/breaking'

export async function getCryptoNews() {
  const response = await fetch(API_URL, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(
      `Crypto API error: ${response.status}`,
    )
  }

  return await response.json()
}