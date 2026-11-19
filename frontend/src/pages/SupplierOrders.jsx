import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { FiTruck, FiCheckCircle, FiPackage, FiFilter, FiPhone, FiX } from 'react-icons/fi'
import { supplierPortalAPI } from '../api/client'
import useSSE, { playNotificationSound } from '../hooks/useSSE'
import { useMoney } from '../utils/money'
import { ORDER_STATUS_COLOR, isPaid } from './SupplierDashboard'
import toast from 'react-hot-toast'

const FILTERS = ['', 'PENDING', 'SUBMITTED', 'IN_DELIVERY', 'DELIVERED']
// What the wholesaler can do next, in delivery order (the backend enforces the same transitions).
const NEXT = {
  PENDING: { status: 'SUBMITTED', icon: FiCheckCircle, cls: 'bg-blue-500 hover:bg-blue-600', key: 'accept' },
  SUBMITTED: { status: 'IN_DELIVERY', icon: FiTruck, cls: 'bg-orange-500 hover:bg-orange-600', key: 'ship' },
  IN_DELIVERY: { status: 'DELIVERED', icon: FiCheckCircle, cls: 'bg-green-500 hover:bg-green-600', key: 'delivered' },
}

export default function SupplierOrders() {
  const { t, i18n } = useTranslation()
  const money = useMoney()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [updating, setUpdating] = useState(null)
  const [refusing, setRefusing] = useState(null)  // two taps to refuse: no accidental cancellation

  const fetchOrders = useCallback(() => {
    setLoading(true)
    supplierPortalAPI.orders(filter || undefined)
      .then(r => setOrders(r.data || []))
      .catch(() => toast.error(t('common.error')))
      .finally(() => setLoading(false))
  }, [filter, t])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  useSSE('/supplier-portal/events', {
    new_order: (data) => {
      playNotificationSound()
      toast.success(t('supplierPortal.newOrderFrom', { shop: data.merchant_name }), { icon: '🛒', duration: 6000 })
      fetchOrders()
    },
    order_update: () => fetchOrders(),
    payment: () => fetchOrders(),
  })

  const updateStatus = async (orderId, status) => {
    setUpdating(orderId)
    try {
      await supplierPortalAPI.updateOrderStatus(orderId, status)
      toast.success(t(`suppliersPage.status.${status}`))
      setRefusing(null)
      fetchOrders()
    } catch (err) {
      toast.error(err.response?.data?.detail || t('common.error'))
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">{t('suppliersPage.orders')}</h1>
        <p className="text-gray-500 text-sm mt-1">{t('supplierPortal.ordersSubtitle')}</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <FiFilter className="h-4 w-4 text-gray-500" />
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filter === f ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {f ? t(`suppliersPage.status.${f}`) : t('supplierPortal.all')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16">
          <FiPackage className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">{t('suppliersPage.noOrders')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const next = NEXT[o.status]
            const canRefuse = o.status === 'PENDING' || o.status === 'SUBMITTED'
            return (
              <div key={o.id} className="bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-sm font-bold text-gray-900">{o.merchant_name}</p>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${ORDER_STATUS_COLOR[o.status] || 'bg-gray-100 text-gray-600'}`}>
                        {t(`suppliersPage.status.${o.status}`, { defaultValue: o.status })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{o.items?.map(it => `${it.product_name} ×${it.quantity}`).join(', ') || '—'}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {o.created_at && new Date(o.created_at).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · #'}{o.id.slice(0, 8).toUpperCase()}
                    </p>
                    {o.merchant_phone && (
                      <div className="flex gap-2 mt-2">
                        <a href={`tel:+${o.merchant_phone}`} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-200">
                          <FiPhone className="h-3 w-3" /> {t('supplierPortal.call')}
                        </a>
                        <a href={`https://wa.me/${o.merchant_phone}`} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 rounded-lg text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                          WhatsApp
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-lg font-black text-gray-900 me-1">{money(o.total_amount)}</p>
                    {canRefuse && (
                      <button onClick={() => refusing === o.id ? updateStatus(o.id, 'CANCELLED') : setRefusing(o.id)}
                        disabled={updating === o.id}
                        className={`flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-xl transition disabled:opacity-50 ${refusing === o.id ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600'}`}>
                        <FiX className="h-3.5 w-3.5" /> {refusing === o.id ? t('supplierPortal.confirmRefuse') : t('supplierPortal.refuse')}
                      </button>
                    )}
                    {next && (
                      <button onClick={() => updateStatus(o.id, next.status)} disabled={updating === o.id}
                        className={`flex items-center gap-1.5 px-3 py-2 ${next.cls} text-white text-xs font-bold rounded-xl transition disabled:opacity-50`}>
                        <next.icon className="h-3.5 w-3.5" /> {t(`supplierPortal.${next.key}`)}
                      </button>
                    )}
                  </div>
                </div>

                {o.payment && (
                  <div className="mt-2 pt-2 border-t border-gray-50 flex items-center gap-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${isPaid(o.payment.status) ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {t(`payments.statuses.${o.payment.status}`, { defaultValue: o.payment.status })}
                    </span>
                    {o.payment.method && (
                      <span className="text-[10px] text-gray-500">{t(`payments.methods.${o.payment.method}`, { defaultValue: o.payment.method })}</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
