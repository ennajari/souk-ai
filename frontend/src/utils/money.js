import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'

const LOCALES = { ar: 'ar-MA', fr: 'fr-FR', en: 'en-US', es: 'es-ES', de: 'de-DE' }

/** Format an amount in the merchant's currency for the UI language (Intl, no hardcoded "MAD"). */
export function formatMoney(amount, currency = 'MAD', lang = 'fr', digits = 2) {
  const n = Number(amount) || 0
  try {
    return new Intl.NumberFormat(LOCALES[lang] || lang, { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)
  } catch {
    return `${n.toFixed(digits)} ${currency}`
  }
}

/** Hook: `const money = useMoney(); money(12.5)` → "12,50 MAD" / "$12.50"; `money(v, 0)` for whole units in tight tiles. */
export function useMoney() {
  const { merchant } = useAuth()
  const { i18n } = useTranslation()
  return (amount, digits = 2) => formatMoney(amount, merchant?.currency || 'MAD', i18n.language, digits)
}
