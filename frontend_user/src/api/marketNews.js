export async function getMarketNews() {
  const apiKey =
    import.meta.env.VITE_ALPHA_VANTAGE_API_KEY?.trim()

  if (!apiKey) {
    throw new Error(
      'Add VITE_ALPHA_VANTAGE_API_KEY to .env and restart Vite.',
    )
  }

  const url = new URL('https://www.alphavantage.co/query')

  url.searchParams.set('function', 'NEWS_SENTIMENT')
  url.searchParams.set('sort', 'LATEST')
  url.searchParams.set('limit', '50')
  url.searchParams.set('apikey', apiKey)

  const response = await fetch(url)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(`News request failed: HTTP ${response.status}`)
  }

  const message =
    data['Error Message'] || data.Information || data.Note

  if (message) {
    throw new Error(message)
  }

  if (!Array.isArray(data.feed)) {
    throw new Error('API response does not contain a news feed.')
  }

  return data.feed.map((item, index) => {
    const match = String(item.time_published || '').match(
      /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/,
    )

    return {
      id: `market-${item.url || index}`,
      category: 'markets',
      title: item.title || 'Market News',
      date: match
        ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`
        : null,
      author: item.source || 'Market News',
      image: item.banner_image || '',
      description: item.summary || '',
      content: item.summary || '',
      link: item.url || '',
    }
  })
}