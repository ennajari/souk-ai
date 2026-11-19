import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FiArrowRight, FiLink, FiCheckCircle, FiTruck, FiInbox, FiPackage } from 'react-icons/fi'
import { supplierPortalAPI } from '../api/client'
import useSSE, { playNotificationSound } from '../hooks/useSSE'
import { useAuth } from '../context/AuthContext'
import { useMoney } from '../utils/money'
import OrderProgress, { isPaid } from '../components/OrderProgress'
import toast from 'react-hot-toast'

export default function SupplierDashboard() {
  const { t } = useTranslation()
  const { merchant } = useAuth()
  const money = useMoney()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [orders, setOrders] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(() => Promise.all([
    supplierPortalAPI.dashboard().catch(() => ({ data: {} })),
    supplierPortalAPI.orders().catch(() => ({ data: [] })),
    supplierPortalAPI.payments().catch(() => ({ data: [] })),
  ]).then(([dashRes, ordersRes, paymentsRes]) => {
    setStats(dashRes.data)
    setOrders((ordersRes.data || []).slice(0, 4))
    setPayments((paymentsRes.data || []).slice(0, 4))
  }), [])

  useEffect(() => { fetchAll().finally(() => setLoading(false)) }, [fetchAll])

  useSSE('/supplier-portal/events', {
    new_order: (data) => {
      playNotificationSound()
      toast.success(t('supplierPortal.newOrderFrom', { shop: data.merchant_name }), { icon: '🛒', duration: 6000 })
      fetchAll()
    },
    payment: () => fetchAll(),
    order_update: () => fetchAll(),
  })

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse" aria-busy="true">
        <div className="h-44 rounded-3xl bg-sand-200" />
        <div className="grid grid-cols-3 gap-3">{[0, 1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-sand-200" />)}</div>
      </div>
    )
  }

  const toAccept = stats?.pending || 0
  const toDeliver = (stats?.submitted || 0) + (stats?.in_delivery || 0)
  const todo = toAccept + toDeliver
  // Shops connect to a wholesaler by adding them with this phone number; share it with them.
  const phone = stats?.phone_number ? `+${stats.phone_number}` : ''
  const shareText = t('supplierPortal.shareText', { phone, url: `${window.location.origin}/register` })

  return (
    <div className="space-y-5">
      {/* What to do now: the one thing a wholesaler opens the app for */}
      <section className="relative overflow-hidden rounded-3xl bg-ink-950 text-white p-6 sm:p-8">
        <div className="absolute -top-16 -end-16 h-56 w-56 rounded-full bg-brand-600/30 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col lg:flex-row lg:items-end gap-6 justify-between">
          <div>
            <p className="text-sm text-gray-400">{merchant?.business_name} · {t('supplierPortal.shopsConnected', { count: stats?.shops || 0 })}</p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight">
              {todo ? t('supplierPortal.todo', { count: todo }) : t('supplierPortal.allDone')}
            </h1>
            {todo > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {toAccept > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-600/20 px-3 py-1 text-brand-200"><FiInbox className="h-3.5 w-3.5" /> {t('supplierPortal.toAccept', { count: toAccept })}</span>}
                {toDeliver > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-300/15 px-3 py-1 text-mint-200"><FiTruck className="h-3.5 w-3.5" /> {t('supplierPortal.toDeliver', { count: toDeliver })}</span>}
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-400">{t('supplierPortal.allDoneHint')}</p>
            )}
            {todo > 0 && (
              <button onClick={() => navigate(`/supplier-orders${toAccept ? '?status=PENDING' : ''}`)}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-5 py-3 font-semibold shadow-lg shadow-brand-900/40 hover:bg-brand-500 transition-colors">
                {t('supplierPortal.handleOrders')} <FiArrowRight className="h-4 w-4 rtl:rotate-180" />
              </button>
            )}
          </div>
          <div className="lg:text-end">
            <p className="text-xs uppercase tracking-wider text-gray-400">{t('supplierPortal.totalReceived')}</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums text-mint-300">{money(stats?.total_revenue)}</p>
          </div>
        </div>
      </section>

      {!stats?.shops && (
        <section className="rounded-3xl border-2 border-dashed border-brand-200 bg-white p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><FiLink className="h-5 w-5" /></span>
            <div>
              <h2 className="font-bold text-ink-900">{t('supplierPortal.connectTitle')}</h2>
              <p className="mt-1 text-sm text-gray-600 max-w-xl">{t('supplierPortal.connectHint', { phone })}</p>
              <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-mint-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-mint-800">
                {t('supplierPortal.shareWhatsApp')}
              </a>
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t('supplierPortal.totalOrders'), value: stats?.total_orders || 0, icon: FiPackage },
          { label: t('suppliersPage.status.IN_DELIVERY'), value: stats?.in_delivery || 0, icon: FiTruck },
          { label: t('suppliersPage.status.DELIVERED'), value: stats?.delivered || 0, icon: FiCheckCircle },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl bg-white border border-sand-200 p-4">
            <c.icon className="h-4 w-4 text-gray-500" />
            <p className="mt-2 text-2xl font-extrabold tabular-nums text-ink-900">{c.value}</p>
            <p className="text-xs text-gray-500">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        <section className="lg:col-span-3 rounded-3xl bg-white border border-sand-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-ink-900">{t('supplierPortal.recentOrders')}</h2>
            <button onClick={() => navigate('/supplier-orders')} className="text-brand-600 text-sm font-semibold inline-flex items-center gap-1 hover:underline">
              {t('supplierPortal.seeAll')} <FiArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
            </button>
          </div>
          {orders.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-10">{t('suppliersPage.noOrders')}</p>
          ) : (
            <ul className="divide-y divide-sand-200">
              {orders.map((o) => (
                <li key={o.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink-900 truncate">{o.merchant_name}</p>
                      <p className="text-xs text-gray-500 truncate">{o.items?.map(it => `${it.product_name} ×${it.quantity}`).join(', ') || '—'}</p>
                    </div>
                    <p className="font-bold tabular-nums text-ink-900 shrink-0">{money(o.total_amount)}</p>
                  </div>
                  <OrderProgress status={o.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lg:col-span-2 rounded-3xl bg-white border border-sand-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-ink-900">{t('supplierPortal.recentPayments')}</h2>
            <button onClick={() => navigate('/supplier-payments')} className="text-brand-600 text-sm font-semibold inline-flex items-center gap-1 hover:underline">
              {t('supplierPortal.seeAll')} <FiArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
            </button>
          </div>
          {payments.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-10">{t('payments.noPayments')}</p>
          ) : (
            <ul className="space-y-3">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900 truncate">{p.merchant_name}</p>
                    <p className="text-xs text-gray-500">{t(`payments.methods.${p.method}`, { defaultValue: p.method })} · {t(`payments.statuses.${p.status}`, { defaultValue: p.status })}</p>
                  </div>
                  <p className={`text-sm font-bold tabular-nums ${isPaid(p.status) ? 'text-mint-700' : 'text-gray-500'}`}>+{money(p.amount)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
