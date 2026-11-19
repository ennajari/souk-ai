import { expect, test } from '@playwright/test'

const phone = () => `06${Math.floor(10_000_000 + Math.random() * 89_999_999)}`
const PASSWORD = 'E2e-pass-2026'

test('onboarding: sign up and land on the dashboard with the money report', async ({ page }) => {
  const start = Date.now()
  await page.goto('/register')
  await page.fill('input[name="business_name"]', 'Hanout E2E')
  await page.fill('input[name="phone_number"]', phone())
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByRole('heading', { name: 'Où est votre argent ?' })).toBeVisible()
  console.log(`signup → dashboard: ${Date.now() - start} ms`)
})

test('sale: add a product at the till, pay cash, stock goes down', async ({ page, request }) => {
  const reg = await request.post('/api/v1/auth/register', {
    data: { phone_number: phone(), password: PASSWORD, business_name: 'Hanout POS' },
  })
  const { access_token: token } = await reg.json()
  const headers = { Authorization: `Bearer ${token}` }
  const prod = await (await request.post('/api/v1/products/', {
    headers, data: { name_fr: 'Sucre E2E', name_ar: 'سكر', unit_price: 12, cost_price: 9, initial_stock: 5 },
  })).json()

  await page.addInitScript((t) => localStorage.setItem('token', t), token)
  await page.goto('/pos')
  const start = Date.now()
  await page.getByRole('button', { name: /Sucre E2E/ }).click()   // tap 1
  await page.getByRole('button', { name: /^Espèces$/ }).click()       // tap 2
  await expect(page.getByRole('heading', { name: /Vente enregistrée/ })).toBeVisible()
  console.log(`2 taps, sale confirmed in ${Date.now() - start} ms`)

  const after = await (await request.get(`/api/v1/products/${prod.id}`, { headers })).json()
  expect(after.stock_quantity).toBe(4)
})

test('login through the UI with a national number typed with spaces', async ({ page, request }) => {
  const digits = phone()
  await request.post('/api/v1/auth/register', { data: { phone_number: digits, password: PASSWORD, business_name: 'Hanout Login' } })
  await page.goto('/login')
  await page.locator('input[type="tel"], input[placeholder="0612345678"]').first().fill(digits.replace(/(\d{2})(?=\d)/g, '$1 '))
  await page.locator('input[type="password"]').first().fill(PASSWORD)
  await page.locator('button[type="submit"]').first().click()
  await expect(page).toHaveURL(/\/dashboard/)
})

test('a shop in France signs up and works in euros', async ({ page }) => {
  await page.goto('/register')
  await page.fill('input[name="business_name"]', 'Épicerie Lyon')
  await page.fill('input[name="phone_number"]', '06' + String(Math.floor(10_000_000 + Math.random() * 89_999_999)))
  await page.fill('input[name="password"]', PASSWORD)
  await page.selectOption('select[name="country_code"]', 'FR')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByText(/€/).first()).toBeVisible()
})

test('USB/Bluetooth scanner at the till: known code sells, unknown code is created on the spot', async ({ page, request }) => {
  const { access_token: token } = await (await request.post('/api/v1/auth/register', {
    data: { phone_number: phone(), password: PASSWORD, business_name: 'Hanout Scan' },
  })).json()
  await request.post('/api/v1/products/', { headers: { Authorization: `Bearer ${token}` },
    data: { name_fr: 'Biscuits', name_ar: 'بسكويت', unit_price: 5, initial_stock: 10, barcode: '4006381333931' } })
  await page.addInitScript((t) => { localStorage.setItem('token', t); localStorage.setItem('i18nextLng', 'fr') }, token)
  await page.goto('/pos')
  const search = page.getByPlaceholder(/Rechercher produit/)
  await search.pressSequentially('4006381333931', { delay: 5 })   // scanner = fast keyboard
  await search.press('Enter')
  await expect(page.getByText('Biscuits').last()).toBeVisible()
  await expect(search).toHaveValue('')

  await search.pressSequentially('96385074', { delay: 5 })        // unknown EAN-8
  await search.press('Enter')
  await page.locator('#qc-name').fill('Chewing-gum')
  await page.locator('#qc-price').fill('2')
  await page.getByRole('button', { name: 'Créer et ajouter au panier' }).click()
  await page.getByRole('button', { name: /^Espèces$/ }).click()
  await expect(page.getByRole('heading', { name: /Vente enregistrée/ })).toBeVisible()
  const list = await (await request.get('/api/v1/products/', { headers: { Authorization: `Bearer ${token}` } })).json()
  expect(list.find((p) => p.barcode === '96385074')?.stock_quantity).toBe(0)  // created with 1, sold 1
})

test('weighed goods: sell 1,25 kg of tomatoes at the till', async ({ page, request }) => {
  const { access_token: token } = await (await request.post('/api/v1/auth/register', {
    data: { phone_number: phone(), password: PASSWORD, business_name: 'Primeur' },
  })).json()
  const headers = { Authorization: `Bearer ${token}` }
  const prod = await (await request.post('/api/v1/products/', { headers,
    data: { name_fr: 'Tomates', name_ar: 'طماطم', unit: 'kg', unit_price: 8, initial_stock: 10 } })).json()
  await page.addInitScript((t) => { localStorage.setItem('token', t); localStorage.setItem('i18nextLng', 'fr') }, token)
  await page.goto('/pos')
  await page.getByRole('button', { name: /Tomates/ }).click()
  const qty = page.getByLabel(/Quantité \(kg\)/)
  await qty.fill('1,25')
  await qty.press('Enter')
  await page.getByRole('button', { name: /^Espèces$/ }).click()
  await expect(page.getByRole('heading', { name: /Vente enregistrée/ })).toBeVisible()
  const after = await (await request.get(`/api/v1/products/${prod.id}`, { headers })).json()
  expect(after.stock_quantity).toBe(8.75)
})

test('accountant export: the monthly sales journal downloads as an Excel-friendly CSV', async ({ page, request }) => {
  const { access_token: token } = await (await request.post('/api/v1/auth/register', {
    data: { phone_number: phone(), password: PASSWORD, business_name: 'Compta test' },
  })).json()
  const headers = { Authorization: `Bearer ${token}` }
  const prod = await (await request.post('/api/v1/products/', { headers,
    data: { name_fr: 'Soda', name_ar: 'مشروب', unit_price: 12, initial_stock: 5, tax_rate: 20 } })).json()
  await request.post('/api/v1/transactions/bulk', { headers,
    data: { items: [{ product_id: prod.id, quantity: 1, unit_price: 12 }] } })
  await page.addInitScript((t) => { localStorage.setItem('token', t); localStorage.setItem('i18nextLng', 'fr') }, token)
  await page.goto('/reports?tab=tax')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Journal des ventes/ }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^journal_ventes_\d{4}-\d{2}\.csv$/)
  const text = (await (await download.createReadStream()).toArray()).join('')
  expect(text.startsWith('﻿Date;Heure;Reference')).toBe(true)
  expect(text).toContain('Soda;1;12,00;12,00;20;2,00;10,00')
})

test('wholesaler: invited by a shop, signs up from the link, accepts and delivers, shop stock goes up', async ({ page, request }) => {
  const shopReg = await request.post('/api/v1/auth/register', { data: { phone_number: phone(), password: PASSWORD, business_name: 'Hanout Grossiste' } })
  const headers = { Authorization: `Bearer ${(await shopReg.json()).access_token}` }
  const prod = await (await request.post('/api/v1/products/', {
    headers, data: { name_fr: 'Lait E2E', name_ar: 'حليب', unit_price: 7, cost_price: 5, initial_stock: 0 },
  })).json()
  const wholesalerPhone = phone()
  const sup = await (await request.post('/api/v1/suppliers/', { headers, data: { name: 'Laiterie E2E', phone_number: wholesalerPhone } })).json()
  expect(sup.is_connected).toBe(false)
  await request.post(`/api/v1/suppliers/${sup.id}/order`, { headers, data: { items: [{ product_id: prod.id, quantity: 24 }] } })

  // the invite link opens sign-up with "Supplier" already chosen
  await page.goto('/register?as=supplier')
  await page.fill('input[name="business_name"]', 'Laiterie E2E')
  await page.fill('input[name="phone_number"]', wholesalerPhone)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/supplier-dashboard/)
  await expect(page.getByText('1 commerce connecté')).toBeVisible()

  await page.goto('/supplier-orders')
  const card = page.locator('div.rounded-2xl', { hasText: 'Hanout Grossiste' }).first()
  await expect(card.getByRole('link', { name: 'WhatsApp' })).toBeVisible()
  for (const action of ['Accepter', 'En livraison', 'Livrée']) {
    await card.getByRole('button', { name: action }).click()
    await expect(card.getByRole('button', { name: action })).toHaveCount(0)
  }
  const after = await (await request.get(`/api/v1/products/${prod.id}`, { headers })).json()
  expect(after.stock_quantity).toBe(24)
})
