import { randomBytes } from 'node:crypto'

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

export function youtubeConnectionPage({ title, message, connect = false }) {
  const nonce = randomBytes(18).toString('base64')
  const content = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} | CMM-FT</title>
<style nonce="${nonce}">*{box-sizing:border-box}body{margin:0;background:#0a1223;color:#edf2fa;font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100dvh;padding:24px}.card{width:100%;max-width:480px;padding:32px;border:1px solid #2d3a51;border-radius:20px;background:#142037}.brand{color:#8bb6ff;font-weight:700;letter-spacing:.08em;font-size:12px}h1{font-size:26px;line-height:1.25;margin:20px 0 12px}p{color:#c6cfdf;line-height:1.65;overflow-wrap:anywhere}button{width:100%;padding:14px 20px;border:0;border-radius:10px;background:#e33545;color:white;font:inherit;font-weight:700;cursor:pointer}button:disabled{opacity:.4;cursor:default}button:focus-visible{outline:2px solid white;outline-offset:4px}.note{font-size:12px;margin-top:18px}</style></head><body><main class="card"><div class="brand">CMM-FT LIVE ALERTS</div><h1>${escape(title)}</h1><p>${escape(message)}</p>
${connect ? `<form method="post" action="/api/youtube/connect"><input type="hidden" name="invite" id="invite"><button id="connect" disabled>Connect YouTube</button></form><p class="note" id="note">Open the complete connection link sent by the site admin.</p><noscript><p>Please enable JavaScript to use this connection link.</p></noscript>
<script nonce="${nonce}">const invite=location.hash.slice(1);if(/^[A-Za-z0-9_-]{43}$/.test(invite)){document.getElementById('invite').value=invite;document.getElementById('connect').disabled=false;document.getElementById('note').textContent='You will choose your channel and approve read-only YouTube access on Google.';history.replaceState(null,'',location.pathname)}</script>` : '<p class="note">You can close this page.</p>'}
</main></body></html>`
  return { content, csp: `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; form-action 'self' https://accounts.google.com; base-uri 'none'; frame-ancestors 'none'` }
}
