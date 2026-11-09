import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FiCornerUpLeft, FiShoppingCart } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { transactionsAPI } from '../api/client'
import { useMoney } from '../utils/money'

/** Sales history. Selling happens at the till (/pos); this page is for checking and returning sales. */
export default function Sales() {
  const { t, i18n } = useTranslation()
  const money = useMoney()
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(null)
  const [confirmId, setConfirmId] = useState(null) // two-step: a stray tap must not return a sale

  const load = () => transactionsAPI.list(null, 100)
    .then((r) => setRows(r.data.filter((x) => x.type === 'SALE' || x.type === 'RETURN')))
    .catch(() => setRows([]))
  useEffect(() => { load() }, [])

  const doReturn = async (sale) => {
    setBusy(sale.id)
    try {
      await transactionsAPI.returnSale(sale.id)
      toast.success(t('sales.returned'))
      await load()
    } catch (err) {
      toast.error(err.response?.data?.detail || t('common.error'))
    } finally {
      setBusy(null)
      setConfirmId(null)
    }
  }

  const dateFmt = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('sales.title')}</h1>
          <p className="text-sm text-gray-500">{t('sales.subtitle')}</p>
        </div>
        <Link to="/pos" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold">
          <FiShoppingCart className="h-4 w-4" aria-hidden="true" /> {t('sales.newSale')}
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
        {rows === null ? (
          <div className="h-48 animate-pulse" aria-busy="true" />
        ) : rows.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-gray-600 font-medium">{t('sales.empty')}</p>
            <Link to="/pos" className="mt-3 inline-block text-brand-700 font-semibold">{t('sales.newSale')} →</Link>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-sand-100 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">{t('customers.product')}</th>
                <th className="px-4 py-3 text-right">{t('common.quantity')}</th>
                <th className="px-4 py-3 text-right">{t('common.total')}</th>
                <th className="px-4 py-3">{t('common.date')}</th>
                <th className="px-4 py-3"><span className="sr-only">{t('common.actions')}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => {
                const isReturn = r.type === 'RETURN'
                return (
                  <tr key={r.id} className={isReturn ? 'bg-red-50/40' : ''}>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{r.product_name_fr || r.product_name_ar}</span>
                      {isReturn && <span className="ms-2 text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">{t('sales.return')}</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.quantity}</td>
                    <td className={`px-4 py-3 text-right font-semibold tabular-nums ${isReturn ? 'text-red-700' : 'text-gray-900'}`}>
                      {isReturn ? '−' : ''}{money(r.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{dateFmt.format(new Date(r.created_at))}</td>
                    <td className="px-4 py-3 text-right">
                      {!isReturn && (confirmId === r.id ? (
                        <span className="inline-flex gap-2">
                          <button onClick={() => doReturn(r)} disabled={busy === r.id}
                            className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-2.5 py-1 rounded-lg disabled:opacity-50">
                            {t('sales.confirmReturn')}
                          </button>
                          <button onClick={() => setConfirmId(null)} className="text-xs text-gray-500">{t('common.cancel')}</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmId(r.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-red-700">
                          <FiCornerUpLeft className="h-3.5 w-3.5" aria-hidden="true" /> {t('sales.doReturn')}
                        </button>
                      ))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
