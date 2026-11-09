import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FiAlertTriangle } from 'react-icons/fi'
import { analyticsAPI } from '../api/client'
import { useMoney } from '../utils/money'

/** VAT collected per rate for a month (prices are tax-inclusive) — what the merchant needs to file. */
export default function TaxReport() {
  const { t } = useTranslation()
  const money = useMoney()
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState(null)

  useEffect(() => {
    setData(null)
    analyticsAPI.taxSummary(offset).then((r) => setData(r.data)).catch(() => setData(false))
  }, [offset])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{t('tax.title')}</h2>
          <p className="text-sm text-gray-500">{t('tax.subtitle')}</p>
        </div>
        <select value={offset} onChange={(e) => setOffset(Number(e.target.value))} aria-label={t('tax.month')}
          className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm">
          <option value={0}>{t('tax.thisMonth')}</option>
          <option value={1}>{t('tax.lastMonth')}</option>
          <option value={2}>{t('tax.monthsAgo', { count: 2 })}</option>
        </select>
      </div>

      {data === null && <div className="h-40 rounded-2xl bg-white animate-pulse" aria-busy="true" />}
      {data === false && <p className="text-red-700">{t('common.error')}</p>}
      {data && (
        <>
          {data.gross_without_rate > 0 && (
            <div className="flex gap-3 items-start rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <FiAlertTriangle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
              <p>
                {t('tax.unsetWarning', { amount: money(data.gross_without_rate) })}{' '}
                <Link to="/products" className="font-semibold underline">{t('tax.setRates')}</Link>
              </p>
            </div>
          )}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-sand-100 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-start">{t('tax.rate')}</th>
                  <th className="px-4 py-3 text-end">{t('tax.gross')}</th>
                  <th className="px-4 py-3 text-end">{t('tax.net')}</th>
                  <th className="px-4 py-3 text-end">{t('tax.tax')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 tabular-nums">
                {data.lines.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">{t('tax.empty')}</td></tr>
                )}
                {data.lines.map((l) => (
                  <tr key={l.rate}>
                    <td className="px-4 py-3 font-semibold">{l.rate} %</td>
                    <td className="px-4 py-3 text-end">{money(l.gross)}</td>
                    <td className="px-4 py-3 text-end">{money(l.net)}</td>
                    <td className="px-4 py-3 text-end font-semibold">{money(l.tax)}</td>
                  </tr>
                ))}
              </tbody>
              {data.lines.length > 0 && (
                <tfoot className="border-t border-gray-200 font-bold">
                  <tr>
                    <td className="px-4 py-3" colSpan={3}>{t('tax.total')} · {data.period}</td>
                    <td className="px-4 py-3 text-end tabular-nums">{money(data.total_tax)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="text-xs text-gray-500">{t('tax.disclaimer')}</p>
        </>
      )}
    </div>
  )
}
