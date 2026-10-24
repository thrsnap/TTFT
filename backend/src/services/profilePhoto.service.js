export async function readProfilePhoto(userId) {
  const startedAt = Date.now()
  const requestedUserId = String(userId ?? '').trim()

  if (!requestedUserId) {
    const error = new Error('A valid userId is required.')
    error.code = 'PROFILE_PHOTO_INVALID_USER_ID'
    error.statusCode = 400
    throw error
  }

  console.log('[PROFILE PHOTO] Request started:', {
    userId: requestedUserId,
  })

  try {
    // 1. Find the photo record in MongoDB.
    const mongoStartedAt = Date.now()

    const photo = await ProfilePhoto.findOne({
      userId: requestedUserId,
    }).lean()

    console.log('[PROFILE PHOTO] MongoDB lookup:', {
      found: Boolean(photo),
      durationMs: Date.now() - mongoStartedAt,
      requestedUserId,
      savedUserId: photo?.userId
        ? String(photo.userId)
        : null,
      hasKey: Boolean(photo?.key),
    })

    if (!photo) {
      return null
    }

    if (!photo.key) {
      const error = new Error(
        'The profile photo record exists but has no storage key.'
      )
      error.code = 'PROFILE_PHOTO_KEY_MISSING'
      error.statusCode = 500
      throw error
    }

    // 2. Retrieve the image from Cloudflare R2.
    const { bucket } = getStorage()
    const r2StartedAt = Date.now()

    const result = await send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: photo.key,
      })
    )

    if (!result.Body) {
      const error = new Error(
        'The profile photo exists in MongoDB, but R2 returned no image body.'
      )
      error.code = 'PROFILE_PHOTO_R2_EMPTY'
      error.statusCode = 502
      throw error
    }

    const bytes = await result.Body.transformToByteArray()
    const body = Buffer.from(bytes)

    console.log('[PROFILE PHOTO] R2 read successful:', {
      durationMs: Date.now() - r2StartedAt,
      totalDurationMs: Date.now() - startedAt,
      sizeBytes: body.length,
      key: photo.key,
    })

    return body
  } catch (error) {
    const statusCode = error?.$metadata?.httpStatusCode
    const errorName = error?.name

    console.error('[PROFILE PHOTO] Read failed:', {
      userId: requestedUserId,
      errorName,
      errorCode: error?.code,
      statusCode,
      durationMs: Date.now() - startedAt,
    })

    // R2 confirms the stored object does not exist.
    if (
      errorName === 'NoSuchKey' ||
      errorName === 'NotFound' ||
      statusCode === 404
    ) {
      const missingError = new Error(
        'The profile photo record exists, but its image is missing from R2.'
      )
      missingError.code = 'PROFILE_PHOTO_OBJECT_MISSING'
      missingError.statusCode = 500
      throw missingError
    }

    throw error
  }
}