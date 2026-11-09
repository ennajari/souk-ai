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
