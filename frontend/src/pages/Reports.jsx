import { lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// One "Reports" place instead of three separate menu entries (sales, margins, restock).
const TABS = [
  { id: 'sales', label: 'reports.sales', Page: lazy(() => import('./Analytics')) },
  { id: 'margins', label: 'reports.margins', Page: lazy(() => import('./Profit')) },
  { id: 'restock', label: 'reports.restock', Page: lazy(() => import('./Forecasts')) },
]

export default function Reports() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const active = TABS.find((x) => x.id === params.get('tab')) || TABS[0]

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label={t('nav.reports')} className="inline-flex gap-1 rounded-xl bg-sand-200 p-1">
        {TABS.map((tab) => (
          <button key={tab.id} role="tab" aria-selected={tab.id === active.id}
            onClick={() => setParams({ tab: tab.id }, { replace: true })}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab.id === active.id ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}>
            {t(tab.label)}
          </button>
        ))}
      </div>
      <Suspense fallback={<div className="h-64 rounded-2xl bg-white animate-pulse" aria-busy="true" />}>
        <active.Page />
      </Suspense>
    </div>
  )
}
