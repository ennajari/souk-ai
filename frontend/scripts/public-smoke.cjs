// Opens the two customer-facing pages (payment link, public catalogue) in a language and reports
// JS errors and leftover French. Usage (stack running, demo shop seeded): node scripts/public-smoke.cjs en
const { chromium } = require('@playwright/test')
const lang = process.argv[2] || 'en'
const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173'
const FR = /\b(Facture|Paiement|Payer|Articles|Commander|Rechercher|Aucun|Propulsé|Épuisé|en stock|Chargement|Numero|Client)\b/g
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' })
  const api = (await b.newContext()).request
  const login = await (await api.post(`${BASE}/api/v1/auth/login`, { data: { phone_number: '0600000001', password: process.env.DEMO_PASSWORD || 'Demo-2026!' } })).json()
  const auth = { Authorization: `Bearer ${login.access_token}` }
  const me = await (await api.get(`${BASE}/api/v1/auth/me`, { headers: auth })).json()
  const inv = await (await api.post(`${BASE}/api/v1/invoices/`, { headers: auth, data: { customer_name: 'Smoke', items: [{ product_name: 'Tea', quantity: 2, unit_price: 12.5 }] } })).json()
  if (!inv.token) throw new Error('invoice not created: ' + JSON.stringify(inv))
  const ctx = await b.newContext({ locale: lang })
  await ctx.addInitScript((l) => localStorage.setItem('i18nextLng', l), lang)
  let bad = 0
  for (const path of [`/pay/${inv.token}`, `/catalogue/${me.id}`]) {
    const p = await ctx.newPage(); const errs = []
    p.on('pageerror', (e) => errs.push(e.message))
    await p.goto(BASE + path, { waitUntil: 'networkidle' }); await p.waitForTimeout(400)
    const text = await p.locator('body').innerText()
    const fr = lang === 'fr' ? [] : [...new Set(text.match(FR) || [])]
    const empty = text.trim().length < 40
    if (errs.length || fr.length || empty) bad++
    console.log(`${errs.length || empty ? '✖' : fr.length ? '△' : '✓'} ${path.split('/')[1]}${errs.length ? ' errors: ' + errs.join(' | ').slice(0, 160) : ''}${empty ? ' (empty page)' : ''}${fr.length ? ' FR: ' + fr.join(', ') : ''}`)
    await p.close()
  }
  await b.close(); process.exit(bad ? 1 : 0)
})()
