import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'

const LOCALES = { ar: 'ar-MA', fr: 'fr-FR', en: 'en-US', es: 'es-ES', de: 'de-DE' }

/** Format an amount in the merchant's currency for the UI language (Intl, no hardcoded "MAD"). */
export function formatMoney(amount, currency = 'MAD', lang = 'fr') {
  const n = Number(amount) || 0
  try {
    return new Intl.NumberFormat(LOCALES[lang] || lang, { style: 'currency', currency, maximumFractionDigits: 2 }).format(n)
  } catch {
    return `${n.toFixed(2)} ${currency}`
  }
}

/** Hook: `const money = useMoney(); money(12.5)` → "12,50 MAD" / "$12.50" / "12,50 €". */
export function useMoney() {
  const { merchant } = useAuth()
  const { i18n } = useTranslation()
  return (amount) => formatMoney(amount, merchant?.currency || 'MAD', i18n.language)
}
