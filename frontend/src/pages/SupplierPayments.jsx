import { useState, useEffect } from 'react'
import { FiCreditCard, FiDollarSign } from 'react-icons/fi'
import { supplierPortalAPI } from '../api/client'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { useMoney } from '../utils/money'
import { isPaid } from '../components/OrderProgress'

const statusColor = {
  PENDING: 'bg-yellow-100 text-yellow-700', PROCESSING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700', PAID: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700', CANCELLED: 'bg-gray-100 text-gray-500',
}

export default function SupplierPayments() {
  const { t, i18n } = useTranslation()
  const money = useMoney()
  const date = (iso, opts) => iso ? new Date(iso).toLocaleDateString(i18n.language, opts) : '-'
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supplierPortalAPI.payments()
      .then(r => setPayments(r.data || []))
      .catch(() => toast.error(t('common.error')))
      .finally(() => setLoading(false))
  }, [])

  const totalReceived = payments
    .filter(p => isPaid(p.status))
    .reduce((sum, p) => sum + Number(p.amount || 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">{t('supplierPortal.paymentsTitle')}</h1>
        <p className="text-gray-500 text-sm mt-1">{t('supplierPortal.paymentsSubtitle')}</p>
      </div>

      {/* Summary */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <FiDollarSign className="h-6 w-6" />
          <p className="text-sm font-medium opacity-80">{t('supplierPortal.totalReceived')}</p>
        </div>
        <p className="text-3xl font-black">{money(totalReceived)}</p>
        <p className="text-sm opacity-70 mt-1">{t('supplierPortal.confirmedCount', { count: payments.filter(p => isPaid(p.status)).length })}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-16">
          <FiCreditCard className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">{t('payments.noPayments')}</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-start">
                  <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase">{t('common.date')}</th>
                  <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase">{t('supplierPortal.shop')}</th>
                  <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase">{t('common.amount')}</th>
                  <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase">{t('payments.method')}</th>
                  <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase">{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-5 py-3 text-gray-600">
                      {date(p.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3 font-semibold text-gray-800">{p.merchant_name}</td>
                    <td className="px-5 py-3 font-bold text-green-600">+{money(p.amount)}</td>
                    <td className="px-5 py-3 text-gray-600">{t(`payments.methods.${p.method}`, { defaultValue: p.method })}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor[p.status] || 'bg-gray-100 text-gray-600'}`}>
                        {t(`payments.statuses.${p.status}`, { defaultValue: p.status })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-50">
            {payments.map((p) => (
              <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{p.merchant_name}</p>
                  <p className="text-xs text-gray-500">
                    {t(`payments.methods.${p.method}`, { defaultValue: p.method })} · {date(p.created_at, { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <div className="text-end">
                  <p className="text-sm font-bold text-green-600">+{money(p.amount)}</p>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor[p.status] || 'bg-gray-100 text-gray-600'}`}>
                    {t(`payments.statuses.${p.status}`, { defaultValue: p.status })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
