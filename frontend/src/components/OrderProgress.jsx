import { useTranslation } from 'react-i18next'
import { FiCheck, FiX } from 'react-icons/fi'

// Delivery steps of a supplier order, in order (the backend enforces the same transitions).
export const STEPS = ['PENDING', 'SUBMITTED', 'IN_DELIVERY', 'DELIVERED']
export const isPaid = (status) => status === 'COMPLETED' || status === 'PAID'

/** Received → Accepted → On the way → Delivered, as a compact tracker. */
export default function OrderProgress({ status }) {
  const { t } = useTranslation()
  if (status === 'CANCELLED') {
    return (
      <p className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500">
        <FiX className="h-3.5 w-3.5" /> {t('suppliersPage.status.CANCELLED')}
      </p>
    )
  }
  const current = STEPS.indexOf(status)
  return (
    <ol className="flex items-center w-full" aria-label={t(`suppliersPage.status.${status}`, { defaultValue: status })}>
      {STEPS.map((step, i) => {
        const done = i < current || status === 'DELIVERED'
        const active = i === current && status !== 'DELIVERED'
        return (
          <li key={step} className={`flex items-center ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
            <div className="flex flex-col items-center gap-1 min-w-0">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                done ? 'bg-mint-700 text-white' : active ? 'bg-brand-600 text-white ring-4 ring-brand-100' : 'bg-sand-200 text-gray-500'}`}>
                {done ? <FiCheck className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={`text-[10px] leading-tight text-center whitespace-nowrap ${active ? 'font-bold text-ink-900' : 'text-gray-500'}`}>
                {t(`supplierPortal.step.${step}`)}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span className={`mx-1 mb-4 h-0.5 flex-1 rounded ${i < current || status === 'DELIVERED' ? 'bg-mint-700' : 'bg-sand-200'}`} />
            )}
          </li>
        )
      })}
    </ol>
  )
}
