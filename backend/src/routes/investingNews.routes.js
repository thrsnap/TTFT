import { Router } from 'express'
import Parser from 'rss-parser'
import News from '../models/news.model.js'

const router = Router()
const parser = new Parser({ timeout: 10000 })

const CACHE_TIME = 5 * 60 * 1000
const RETRY_DELAY = 60 * 1000
const MAX_ARTICLES = 100
const SOURCE = 'Investing.com'

function safeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return ''
  }

  try {
    const url = new URL(value.trim())

    return ['https:', 'http:'].includes(url.protocol)
      ? url.href
      : ''
  } catch {
    return ''
  }
}

function safeDate(...values) {
  for (const value of values) {
    if (!value) continue

    const date = new Date(value)

    if (!Number.isNaN(date.getTime())) {
      return date
    }
  }

  return null
}

function toIsoDate(value) {
  return safeDate(value)?.toISOString() ?? null
}

function createFeedHandler(feedUrl, category) {
  let lastFetchedAt = 0
  let pendingRequest = null
  let retryAfter = 0

  const filter = {
    source: SOURCE,
    category,
  }

  async function readSavedNews() {
    const articles = await News.find(filter)
      .sort({
        publishedAt: -1,
        createdAt: -1,
        _id: -1,
      })
      .limit(MAX_ARTICLES)
      .lean()

    return articles.map((article) => ({
      id: String(article._id),
      title: article.title,
      description: article.description || '',
      image: article.image || '',
      link: article.link,

      // Original source publication time.
      publishedAt: toIsoDate(article.publishedAt),

      // First saved to your website.
      // Refreshing an existing article does not reset this.
      addedAt: toIsoDate(article.createdAt),

      source: article.source,
      category: article.category,
    }))
  }

  async function fetchAndSaveNews() {
    const feed = await parser.parseURL(feedUrl)

    if (!Array.isArray(feed.items)) {
      throw new Error('Invalid news feed')
    }

    const articles = feed.items
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        title: item.title || 'Untitled',
        description: item.contentSnippet || '',
        image: item.enclosure?.type?.startsWith('image/')
          ? safeUrl(item.enclosure.url)
          : '',
        link: safeUrl(item.link),
        publishedAt: safeDate(item.isoDate, item.pubDate),
        source: SOURCE,
        category,
      }))
      .filter((article) => article.link)

    const uniqueArticles = [
      ...new Map(
        articles.map((article) => [article.link, article]),
      ).values(),
    ]

    if (uniqueArticles.length > 0) {
      await News.bulkWrite(
        uniqueArticles.map((article) => {
          const { publishedAt, ...fields } = article

          return {
            updateOne: {
              filter: {
                source: SOURCE,
                category,
                link: article.link,
              },
              update: {
                $set: {
                  ...fields,
                  ...(publishedAt ? { publishedAt } : {}),
                },
              },
              upsert: true,
            },
          }
        }),
      )
    }

    const olderArticles = await News.find(filter)
      .sort({
        publishedAt: -1,
        createdAt: -1,
        _id: -1,
      })
      .skip(MAX_ARTICLES)
      .select('_id')
      .lean()

    if (olderArticles.length > 0) {
      await News.deleteMany({
        ...filter,
        _id: {
          $in: olderArticles.map((article) => article._id),
        },
      })
    }

    lastFetchedAt = Date.now()
    retryAfter = 0
  }

  function sendNews(res, news, stale) {
    return res.json({
      success: true,
      stale,
      lastFetchedAt: lastFetchedAt
        ? new Date(lastFetchedAt).toISOString()
        : null,
      news,
    })
  }

  return async (req, res) => {
    res.set('Cache-Control', 'no-store')

    try {
      const cacheIsFresh =
        lastFetchedAt > 0 &&
        Date.now() - lastFetchedAt < CACHE_TIME

      if (cacheIsFresh) {
        return sendNews(res, await readSavedNews(), false)
      }

      if (Date.now() < retryAfter) {
        const savedNews = await readSavedNews()

        if (savedNews.length > 0) {
          return sendNews(res, savedNews, true)
        }

        return res.status(503).json({
          success: false,
          message: `${category} news is temporarily unavailable.`,
        })
      }

      // Share one upstream request between concurrent visitors.
      if (!pendingRequest) {
        pendingRequest = fetchAndSaveNews()
          .catch((error) => {
            retryAfter = Date.now() + RETRY_DELAY
            throw error
          })
          .finally(() => {
            pendingRequest = null
          })
      }

      await pendingRequest

      return sendNews(res, await readSavedNews(), false)
    } catch (error) {
      console.error(`${category} RSS error:`, error.message)

      try {
        const savedNews = await readSavedNews()

        if (savedNews.length > 0) {
          return sendNews(res, savedNews, true)
        }
      } catch (databaseError) {
        console.error(
          `${category} database error:`,
          databaseError.message,
        )
      }

      return res.status(502).json({
        success: false,
        message: `Unable to load ${category.toLowerCase()} news.`,
      })
    }
  }
}

router.get(
  '/',
  createFeedHandler(
    'https://www.investing.com/rss/news_14.rss',
    'Economy',
  ),
)

router.get(
  '/markets',
  createFeedHandler(
    'https://www.investing.com/rss/news_25.rss',
    'Markets',
  ),
)

router.get(
  '/insider',
  createFeedHandler(
    'https://www.investing.com/rss/news_357.rss',
    'Insider Trading',
  ),
)

router.get(
  '/forex',
  createFeedHandler(
    'https://www.investing.com/rss/news_1.rss',
    'Forex',
  ),
)

router.get(
  '/crypto',
  createFeedHandler(
    'https://in.investing.com/rss/news_301.rss',
    'Crypto',
  ),
)

export default router