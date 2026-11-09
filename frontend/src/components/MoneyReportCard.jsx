import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FiArrowDownCircle, FiAlertOctagon, FiClock, FiShoppingBag } from 'react-icons/fi'
import { analyticsAPI } from '../api/client'
import { useMoney } from '../utils/money'

/** "Where is my money?" — money to recover + money lost/at risk, each with the next action. */
export default function MoneyReportCard() {
  const { t } = useTranslation()
  const money = useMoney()
  const [rep, setRep] = useState(null)

  useEffect(() => {
    analyticsAPI.moneyReport().then((r) => setRep(r.data)).catch(() => setRep(false))
  }, [])

  if (rep === false) return null
  if (!rep) return <div className="h-40 rounded-2xl bg-gray-100 animate-pulse" aria-busy="true" />

  const rows = [
    { icon: FiArrowDownCircle, tone: 'text-emerald-700 bg-emerald-50', label: t('money.toRecover'),
      value: rep.to_recover.total, hint: t('money.customers', { count: rep.to_recover.customers }), to: '/customers' },
    { icon: FiAlertOctagon, tone: 'text-red-700 bg-red-50', label: t('money.lost'),
      value: rep.lost.total, hint: t('money.expiredHint', { count: rep.lost.expired.length }), to: '/products' },
    { icon: FiClock, tone: 'text-amber-700 bg-amber-50', label: t('money.atRisk'),
      value: rep.at_risk.total, hint: t('money.atRiskHint', { soon: rep.at_risk.expiring_soon.length, dead: rep.at_risk.dead_stock.length }), to: '/products' },
    { icon: FiShoppingBag, tone: 'text-brand-700 bg-brand-50', label: t('money.missedSales'),
      value: rep.missed_sales_per_week.total, hint: t('money.missedHint', { count: rep.missed_sales_per_week.out_of_stock.length }), to: '/forecasts' },
  ]

  return (
    <section aria-labelledby="money-title" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 id="money-title" className="text-base font-bold text-gray-900 mb-4">{t('money.title')}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {rows.map(({ icon: Icon, tone, label, value, hint, to }) => (
          <Link key={label} to={to}
            className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:border-brand-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 transition">
            <span className={`p-2 rounded-lg ${tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
            <span className="min-w-0">
              <span className="block text-xs text-gray-600">{label}</span>
              <span className="block text-lg font-bold text-gray-900 tabular-nums">{money(value)}</span>
              <span className="block text-xs text-gray-500 truncate">{hint}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
