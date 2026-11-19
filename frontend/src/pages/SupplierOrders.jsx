import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FiTruck, FiCheckCircle, FiPackage, FiPhone, FiX, FiMessageCircle } from 'react-icons/fi'
import { supplierPortalAPI } from '../api/client'
import useSSE, { playNotificationSound } from '../hooks/useSSE'
import { useMoney } from '../utils/money'
import OrderProgress, { isPaid } from '../components/OrderProgress'
import toast from 'react-hot-toast'

const FILTERS = ['', 'PENDING', 'SUBMITTED', 'IN_DELIVERY', 'DELIVERED']
// The one next step for each status (the backend enforces the same transitions).
const NEXT = {
  PENDING: { status: 'SUBMITTED', icon: FiCheckCircle, key: 'accept' },
  SUBMITTED: { status: 'IN_DELIVERY', icon: FiTruck, key: 'ship' },
  IN_DELIVERY: { status: 'DELIVERED', icon: FiCheckCircle, key: 'delivered' },
}

export default function SupplierOrders() {
  const { t, i18n } = useTranslation()
  const money = useMoney()
  const [params, setParams] = useSearchParams()
  const filter = FILTERS.includes(params.get('status')) ? params.get('status') : ''
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)
  const [refusing, setRefusing] = useState(null)  // two taps to refuse: no accidental cancellation

  // shortcut: loads every order and filters in the browser (gives tab counts); paginate past ~1k orders
  const fetchOrders = useCallback(() => supplierPortalAPI.orders()
    .then(r => setOrders(r.data || []))
    .catch(() => toast.error(t('common.error')))
    .finally(() => setLoading(false)), [t])

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
      await fetchOrders()
    } catch (err) {
      toast.error(err.response?.data?.detail || t('common.error'))
    } finally {
      setUpdating(null)
    }
  }

  const count = (f) => f ? orders.filter(o => o.status === f).length : orders.length
  const shown = filter ? orders.filter(o => o.status === filter) : orders

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-900">{t('suppliersPage.orders')}</h1>
        <p className="text-gray-500 text-sm mt-1">{t('supplierPortal.ordersSubtitle')}</p>
      </div>

      <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
        <div className="flex gap-2 w-max" role="tablist">
          {FILTERS.map((f) => (
            <button key={f} role="tab" aria-selected={filter === f}
              onClick={() => setParams(f ? { status: f } : {}, { replace: true })}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                filter === f ? 'bg-ink-900 text-white' : 'bg-white border border-sand-200 text-gray-600 hover:border-brand-300'}`}>
              {f ? t(`suppliersPage.status.${f}`) : t('supplierPortal.all')}
              <span className={`tabular-nums text-xs rounded-full px-1.5 ${filter === f ? 'bg-white/20' : 'bg-sand-200 text-gray-600'}`}>{count(f)}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse" aria-busy="true">{[0, 1].map(i => <div key={i} className="h-48 rounded-3xl bg-sand-200" />)}</div>
      ) : shown.length === 0 ? (
        <div className="rounded-3xl bg-white border border-sand-200 text-center py-16">
          <FiPackage className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">{t('suppliersPage.noOrders')}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((o) => {
            const next = NEXT[o.status]
            const canRefuse = o.status === 'PENDING' || o.status === 'SUBMITTED'
            const busy = updating === o.id
            return (
              <li key={o.id} className={`rounded-3xl bg-white border p-5 transition-shadow hover:shadow-md ${o.status === 'PENDING' ? 'border-brand-200 shadow-sm shadow-brand-100' : 'border-sand-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-ink-900 truncate">{o.merchant_name}</p>
                    <p className="text-xs text-gray-500">
                      #{o.id.slice(0, 8).toUpperCase()}
                      {o.created_at && ` · ${new Date(o.created_at).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                    </p>
                  </div>
                  <div className="text-end shrink-0">
                    <p className="text-xl font-extrabold tabular-nums text-ink-900">{money(o.total_amount)}</p>
                    {o.payment && (
                      <p className={`text-xs font-semibold ${isPaid(o.payment.status) ? 'text-mint-700' : 'text-amber-700'}`}>
                        {t(`payments.statuses.${o.payment.status}`, { defaultValue: o.payment.status })}
                        {o.payment.method && ` · ${t(`payments.methods.${o.payment.method}`, { defaultValue: o.payment.method })}`}
                      </p>
                    )}
                  </div>
                </div>

                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {(o.items || []).map((it, i) => (
                    <li key={i} className="rounded-lg bg-sand-100 px-2.5 py-1 text-xs text-ink-800">
                      <span className="font-bold tabular-nums">{it.quantity}×</span> {it.product_name}
                    </li>
                  ))}
                </ul>

                <div className="mt-4"><OrderProgress status={o.status} /></div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-sand-200 pt-4">
                  {o.merchant_phone && (
                    <>
                      <a href={`tel:+${o.merchant_phone}`} aria-label={t('supplierPortal.call')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-sand-100 px-3 py-2 text-sm font-semibold text-ink-800 hover:bg-sand-200">
                        <FiPhone className="h-4 w-4" /> <span className="hidden sm:inline">{t('supplierPortal.call')}</span>
                      </a>
                      <a href={`https://wa.me/${o.merchant_phone}`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-mint-50 px-3 py-2 text-sm font-semibold text-mint-800 hover:bg-mint-100">
                        <FiMessageCircle className="h-4 w-4" /> WhatsApp
                      </a>
                    </>
                  )}
                  <div className="ms-auto flex items-center gap-2">
                    {canRefuse && (
                      <button onClick={() => refusing === o.id ? updateStatus(o.id, 'CANCELLED') : setRefusing(o.id)} disabled={busy}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                          refusing === o.id ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-red-50 hover:text-red-700'}`}>
                        <FiX className="h-4 w-4" /> {refusing === o.id ? t('supplierPortal.confirmRefuse') : t('supplierPortal.refuse')}
                      </button>
                    )}
                    {next && (
                      <button onClick={() => updateStatus(o.id, next.status)} disabled={busy}
                        className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50">
                        <next.icon className="h-4 w-4" /> {t(`supplierPortal.${next.key}`)}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
