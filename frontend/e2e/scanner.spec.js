// Camera barcode scanning on a browser WITHOUT a native BarcodeDetector (iPhone Safari, Firefox, desktop):
// the camera is faked with a video of a slightly blurred EAN-13. Needs ffmpeg (skipped otherwise).
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const png = new URL('./fixtures/ean13-4006381333931.png', import.meta.url).pathname
const video = 'test-results/fake-camera-ean13.y4m'
let hasFfmpeg = true
try {
  mkdirSync('test-results', { recursive: true })
  if (!existsSync(video)) {
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-loop', '1', '-i', png, '-t', '3', '-r', '10', '-pix_fmt', 'yuv420p', video])
  }
} catch { hasFfmpeg = false }

test.use({
  permissions: ['camera'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`] },
})

test('camera scan reads an EAN-13 without a native detector', async ({ page, request }) => {
  test.skip(!hasFfmpeg, 'ffmpeg not available')
  const phone = `06${Math.floor(10_000_000 + Math.random() * 89_999_999)}`
  const { access_token: token } = await (await request.post('/api/v1/auth/register', {
    data: { phone_number: phone, password: 'E2e-pass-2026', business_name: 'Scan test' },
  })).json()
  await page.addInitScript((t) => { localStorage.setItem('token', t); localStorage.setItem('i18nextLng', 'fr') }, token)
  await page.goto('/products')
  await page.getByRole('button', { name: 'Ajouter', exact: true }).first().click()
  await page.getByRole('button', { name: 'Scanner avec la caméra' }).click()
  await expect(page.locator('input[name=barcode]')).toHaveValue('4006381333931', { timeout: 20_000 })
})
