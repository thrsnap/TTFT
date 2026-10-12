export default function requireAuth(req, res, next) {
  const userId = req.session?.userId

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Please log in first',
    })
  }

  req.user = {
    id: String(userId),
  }

  next()
}