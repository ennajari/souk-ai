// Opens every merchant page in a language and reports JS errors + leftover French words in the UI.
// Usage (stack running, demo shop seeded): node scripts/i18n-smoke.cjs en
const { chromium } = require('@playwright/test')
const lang = process.argv[2] || 'en'
const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173'
const PAGES = ['/dashboard', '/pos', '/products', '/sales', '/customers', '/suppliers', '/reports', '/reports?tab=margins',
  '/reports?tab=restock', '/reports?tab=tax', '/payments', '/marketplace', '/my-catalogue', '/employees', '/coach',
  '/sage-import', '/settings', '/notifications']
// frequent French words that should never appear in the EN/AR UI (product names from the demo are ignored)
const FR = /\b(Ajouter|Annuler|Enregistrer|Supprimer|Modifier|Rechercher|Fournisseur|Commande|Paiement|Montant|Aucun|Aucune|Chargement|Erreur|Produits?|Ventes?|Prix|Quantité|Statut|Nouvelle?|Mes|Votre|Vos|Créer|Télécharger)\b/g
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' })
  const c0 = await b.newContext()
  const token = (await (await c0.request.post(`${BASE}/api/v1/auth/login`, { data: { phone_number: '0600000001', password: process.env.DEMO_PASSWORD || 'Demo-2026!' } })).json()).access_token
  const ctx = await b.newContext({ locale: lang, viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript(([t, l]) => { localStorage.setItem('token', t); localStorage.setItem('i18nextLng', l) }, [token, lang])
  let bad = 0
  for (const path of PAGES) {
    const p = await ctx.newPage(); const errs = []
    p.on('pageerror', (e) => errs.push(e.message))
    await p.goto(BASE + path, { waitUntil: 'networkidle' }); await p.waitForTimeout(400)
    const text = await p.locator('main').innerText().catch(() => '')
    const fr = lang === 'fr' ? [] : [...new Set(text.match(FR) || [])]
    if (errs.length || fr.length) bad++
    console.log(`${errs.length ? '✖' : fr.length ? '△' : '✓'} ${path}${errs.length ? ' errors: ' + errs.join(' | ').slice(0, 160) : ''}${fr.length ? ' FR: ' + fr.join(', ') : ''}`)
    await p.close()
  }
  await b.close(); process.exit(bad ? 1 : 0)
})()
