import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FiPackage, FiClock, FiTruck, FiCheckCircle, FiDollarSign, FiArrowRight, FiLink } from 'react-icons/fi'
import { supplierPortalAPI } from '../api/client'
import useSSE, { playNotificationSound } from '../hooks/useSSE'
import { useMoney } from '../utils/money'
import toast from 'react-hot-toast'

export const ORDER_STATUS_COLOR = {
  PENDING: 'bg-yellow-100 text-yellow-700', SUBMITTED: 'bg-blue-100 text-blue-700',
  IN_DELIVERY: 'bg-orange-100 text-orange-700', DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}
export const isPaid = (status) => status === 'COMPLETED' || status === 'PAID'

export default function SupplierDashboard() {
  const { t } = useTranslation()
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
    setOrders((ordersRes.data || []).slice(0, 5))
    setPayments((paymentsRes.data || []).slice(0, 5))
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
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Shops connect to a wholesaler by adding them with this phone number; share it with them.
  const phone = stats?.phone_number ? `+${stats.phone_number}` : ''
  const shareText = t('supplierPortal.shareText', { phone, url: `${window.location.origin}/register` })

  const cards = [
    { label: t('supplierPortal.totalOrders'), value: stats?.total_orders || 0, icon: FiPackage, cls: 'bg-brand-50 border-brand-100 text-brand-600' },
    { label: t('suppliersPage.status.PENDING'), value: stats?.pending || 0, icon: FiClock, cls: 'bg-yellow-50 border-yellow-100 text-yellow-600' },
    { label: t('suppliersPage.status.IN_DELIVERY'), value: stats?.in_delivery || 0, icon: FiTruck, cls: 'bg-orange-50 border-orange-100 text-orange-600' },
    { label: t('suppliersPage.status.DELIVERED'), value: stats?.delivered || 0, icon: FiCheckCircle, cls: 'bg-green-50 border-green-100 text-green-600' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">{t('nav.dashboard')}</h1>
        <p className="text-gray-500 text-sm mt-1">{t('supplierPortal.shopsConnected', { count: stats?.shops || 0 })}</p>
      </div>

      {!stats?.shops && (
        <div className="bg-white border-2 border-dashed border-brand-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <FiLink className="h-5 w-5 text-brand-600" />
            <h2 className="font-bold text-gray-900">{t('supplierPortal.connectTitle')}</h2>
          </div>
          <p className="text-sm text-gray-600">{t('supplierPortal.connectHint', { phone })}</p>
          <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 mt-3 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">
            {t('supplierPortal.shareWhatsApp')}
          </a>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className={`${c.cls} border rounded-2xl p-4`}>
            <c.icon className="h-5 w-5 mb-3" />
            <p className="text-2xl font-black text-gray-900">{c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-r from-brand-600 to-brand-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <FiDollarSign className="h-6 w-6" />
          <p className="text-sm font-medium opacity-80">{t('supplierPortal.totalReceived')}</p>
        </div>
        <p className="text-3xl font-black">{money(stats?.total_revenue)}</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">{t('supplierPortal.recentOrders')}</h2>
            <button onClick={() => navigate('/supplier-orders')} className="text-brand-600 text-xs font-semibold flex items-center gap-1 hover:underline">
              {t('supplierPortal.seeAll')} <FiArrowRight className="h-3 w-3 rtl:rotate-180" />
            </button>
          </div>
          {orders.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">{t('suppliersPage.noOrders')}</p>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{o.merchant_name}</p>
                    <p className="text-xs text-gray-500">{o.items?.map(it => `${it.product_name} ×${it.quantity}`).join(', ') || '—'}</p>
                  </div>
                  <div className="text-end">
                    <p className="text-sm font-bold text-gray-900">{money(o.total_amount)}</p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${ORDER_STATUS_COLOR[o.status] || 'bg-gray-100 text-gray-600'}`}>
                      {t(`suppliersPage.status.${o.status}`, { defaultValue: o.status })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">{t('supplierPortal.recentPayments')}</h2>
            <button onClick={() => navigate('/supplier-payments')} className="text-brand-600 text-xs font-semibold flex items-center gap-1 hover:underline">
              {t('supplierPortal.seeAll')} <FiArrowRight className="h-3 w-3 rtl:rotate-180" />
            </button>
          </div>
          {payments.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">{t('payments.noPayments')}</p>
          ) : (
            <div className="space-y-3">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{p.merchant_name}</p>
                    <p className="text-xs text-gray-500">{t(`payments.methods.${p.method}`, { defaultValue: p.method })}</p>
                  </div>
                  <div className="text-end">
                    <p className="text-sm font-bold text-green-600">+{money(p.amount)}</p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${isPaid(p.status) ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {t(`payments.statuses.${p.status}`, { defaultValue: p.status })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
