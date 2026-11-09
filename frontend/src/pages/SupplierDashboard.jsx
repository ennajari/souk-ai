import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiPackage, FiClock, FiTruck, FiCheckCircle, FiDollarSign, FiArrowRight, FiBell } from 'react-icons/fi'
import { supplierPortalAPI } from '../api/client'
import useSSE, { playNotificationSound } from '../hooks/useSSE'
import toast from 'react-hot-toast'

const STATUS_LABELS = {
  PENDING: 'En attente', SUBMITTED: 'Soumise', IN_DELIVERY: 'En livraison',
  DELIVERED: 'Livree', CANCELLED: 'Annulee',
}
const statusColor = {
  PENDING: 'bg-yellow-100 text-yellow-700', SUBMITTED: 'bg-blue-100 text-blue-700',
  IN_DELIVERY: 'bg-orange-100 text-orange-700', DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}
const PAYMENT_STATUS = {
  COMPLETED: 'bg-green-100 text-green-700', PAID: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
}

export default function SupplierDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [orders, setOrders] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(() => {
    return Promise.all([
      supplierPortalAPI.dashboard().catch(() => ({ data: {} })),
      supplierPortalAPI.orders().catch(() => ({ data: [] })),
      supplierPortalAPI.payments().catch(() => ({ data: [] })),
    ]).then(([dashRes, ordersRes, paymentsRes]) => {
      setStats(dashRes.data)
      setOrders((ordersRes.data || []).slice(0, 5))
      setPayments((paymentsRes.data || []).slice(0, 5))
    })
  }, [])

  useEffect(() => {
    fetchAll().finally(() => setLoading(false))
  }, [fetchAll])

  // SSE real-time updates
  useSSE('/supplier-portal/events', {
    new_order: (data) => {
      playNotificationSound()
      toast.success(`Nouvelle commande de ${data.merchant_name}`, { icon: '🛒', duration: 6000 })
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

  const cards = [
    { label: 'Total commandes', value: stats?.total_orders || 0, icon: FiPackage, color: 'violet' },
    { label: 'En attente', value: stats?.pending || 0, icon: FiClock, color: 'yellow' },
    { label: 'En livraison', value: stats?.in_delivery || 0, icon: FiTruck, color: 'orange' },
    { label: 'Livrees', value: stats?.delivered || 0, icon: FiCheckCircle, color: 'green' },
  ]

  const colorMap = {
    violet: { bg: 'bg-brand-50', icon: 'text-brand-600', border: 'border-brand-100' },
    yellow: { bg: 'bg-yellow-50', icon: 'text-yellow-600', border: 'border-yellow-100' },
    orange: { bg: 'bg-orange-50', icon: 'text-orange-600', border: 'border-orange-100' },
    green: { bg: 'bg-green-50', icon: 'text-green-600', border: 'border-green-100' },
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Tableau de bord</h1>
        <p className="text-gray-500 text-sm mt-1">Vue d'ensemble de votre activite fournisseur</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const cm = colorMap[c.color]
          return (
            <div key={c.label} className={`${cm.bg} border ${cm.border} rounded-2xl p-4`}>
              <div className="flex items-center justify-between mb-3">
                <c.icon className={`h-5 w-5 ${cm.icon}`} />
              </div>
              <p className="text-2xl font-black text-gray-900">{c.value}</p>
              <p className="text-xs text-gray-500 mt-1">{c.label}</p>
            </div>
          )
        })}
      </div>

      {/* Revenue card */}
      <div className="bg-gradient-to-r from-brand-600 to-brand-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <FiDollarSign className="h-6 w-6" />
          <p className="text-sm font-medium opacity-80">Total paiements recus</p>
        </div>
        <p className="text-3xl font-black">{Number(stats?.total_revenue || 0).toFixed(2)} MAD</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent orders */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Commandes recentes</h2>
            <button onClick={() => navigate('/supplier-orders')} className="text-brand-600 text-xs font-semibold flex items-center gap-1 hover:underline">
              Voir tout <FiArrowRight className="h-3 w-3" />
            </button>
          </div>
          {orders.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">Aucune commande</p>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{o.merchant_name || 'Marchand'}</p>
                    <p className="text-xs text-gray-500">
                      {o.items?.length > 0
                        ? o.items.map(it => `${it.product_name} x${it.quantity}`).join(', ')
                        : '—'
                      }
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{Number(o.total_amount || 0).toFixed(2)} MAD</p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor[o.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[o.status] || o.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent payments */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Paiements recents</h2>
            <button onClick={() => navigate('/supplier-payments')} className="text-brand-600 text-xs font-semibold flex items-center gap-1 hover:underline">
              Voir tout <FiArrowRight className="h-3 w-3" />
            </button>
          </div>
          {payments.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">Aucun paiement</p>
          ) : (
            <div className="space-y-3">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{p.merchant_name || 'Marchand'}</p>
                    <p className="text-xs text-gray-500">{p.method === 'CASH' ? 'Especes' : p.method === 'NFC_SOUKCARD' ? 'Carte Souk.AI' : p.method}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600">+{Number(p.amount || 0).toFixed(2)} MAD</p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${PAYMENT_STATUS[p.status] || 'bg-gray-100 text-gray-600'}`}>
                      {p.status === 'COMPLETED' || p.status === 'PAID' ? 'Recu' : 'En attente'}
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
