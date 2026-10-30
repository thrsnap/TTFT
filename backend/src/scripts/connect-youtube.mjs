// Run from backend: node --env-file=.env src/scripts/connect-youtube.mjs
// The approval returns to Render, so the owner can use another device.
import 'dotenv/config'

async function main() {
  const key = process.env.ADMIN_API_KEY?.trim()
  if (!key) throw new Error('Load your existing backend ADMIN_API_KEY with --env-file=.env.')
  const callback = new URL(process.env.YOUTUBE_REDIRECT_URI || 'https://api.cmm-ft.com/api/youtube/oauth/callback')
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(callback.hostname)
  if (callback.protocol !== 'https:' && !(local && callback.protocol === 'http:')) throw new Error('Use your HTTPS API callback URL.')
  const statusOnly = process.argv.includes('--status')
  const channelId = process.argv.find(value => value.startsWith('--channel='))?.slice('--channel='.length)
  const response = await fetch(callback.origin + '/api/youtube/' + (statusOnly ? 'connection' : 'connect-links'), {
    method: statusOnly ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-CMM-Request': '1' },
    ...(statusOnly ? {} : { body: JSON.stringify(channelId ? { channelId } : {}) }),
    signal: AbortSignal.timeout(45000),
  })
  let data
  try { data = await response.json() } catch { throw new Error('The API did not return JSON. Deploy the updated YouTube route and check its mount before the 404 handler.') }
  if (!response.ok) throw new Error(data.message || `API request failed (HTTP ${response.status}).`)
  if (statusOnly) {
    console.log(data.connected ? `Connected channel: ${data.channelTitle || data.channelId}\nChannel ID: ${data.channelId}` : 'No channel connected with the current web client yet.')
    return
  }
  console.log('Share this complete link with the YouTube channel owner:')
  console.log(data.connectUrl)
  console.log(`\nLink expires: ${data.expiresAt} (30 minutes after creation).`)
  console.log('The owner may approve on their phone or computer. Approval is saved on your API server.')
  console.log('You can close this terminal. Later, check with:')
  console.log('node --env-file=.env src/scripts/connect-youtube.mjs --status')
}

main().catch(error => { console.error(error.message); process.exitCode = 1 })
