import { useState, useEffect } from 'react'
import { FiTruck, FiCheckCircle, FiPackage, FiFilter } from 'react-icons/fi'
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
const FILTERS = [
  { value: '', label: 'Toutes' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'SUBMITTED', label: 'Soumises' },
  { value: 'IN_DELIVERY', label: 'En livraison' },
  { value: 'DELIVERED', label: 'Livrees' },
]

export default function SupplierOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [updating, setUpdating] = useState(null)

  const fetchOrders = () => {
    setLoading(true)
    supplierPortalAPI.orders(filter || undefined)
      .then(r => setOrders(r.data || []))
      .catch(() => toast.error('Erreur chargement commandes'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchOrders() }, [filter])

  // SSE real-time updates
  useSSE('/supplier-portal/events', {
    new_order: (data) => {
      playNotificationSound()
      toast.success(`Nouvelle commande de ${data.merchant_name}`, { icon: '🛒', duration: 6000 })
      fetchOrders()
    },
    order_update: () => fetchOrders(),
    payment: () => fetchOrders(),
  })

  const updateStatus = async (orderId, newStatus) => {
    setUpdating(orderId)
    try {
      await supplierPortalAPI.updateOrderStatus(orderId, newStatus)
      const msgs = { SUBMITTED: 'Commande confirmee', IN_DELIVERY: 'Commande en livraison', DELIVERED: 'Commande livree' }
      toast.success(msgs[newStatus] || 'Statut mis a jour')
      fetchOrders()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur mise a jour')
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Commandes</h1>
        <p className="text-gray-500 text-sm mt-1">Gerez les commandes de vos marchands</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <FiFilter className="h-4 w-4 text-gray-400" />
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === f.value
                ? 'bg-violet-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16">
          <FiPackage className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">Aucune commande{filter ? ` avec le statut "${STATUS_LABELS[filter]}"` : ''}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold text-gray-900">{o.merchant_name || 'Marchand'}</p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor[o.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[o.status] || o.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {o.items?.length > 0
                      ? o.items.map((it, idx) => (
                          <span key={idx}>{it.product_name} x{it.quantity}{idx < o.items.length - 1 ? ', ' : ''}</span>
                        ))
                      : o.product_name ? `${o.product_name} x${o.quantity || 0}` : 'Aucun article'
                    }
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {o.created_at ? new Date(o.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-lg font-black text-gray-900">{Number(o.total_amount || o.total_cost || 0).toFixed(2)}</p>
                    <p className="text-[10px] text-gray-400">MAD</p>
                  </div>

                  {/* Action buttons — PENDING→SUBMITTED→IN_DELIVERY→DELIVERED */}
                  {o.status === 'PENDING' && (
                    <button
                      onClick={() => updateStatus(o.id, 'SUBMITTED')}
                      disabled={updating === o.id}
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition disabled:opacity-50"
                    >
                      <FiCheckCircle className="h-3.5 w-3.5" />
                      Confirmer
                    </button>
                  )}
                  {o.status === 'SUBMITTED' && (
                    <button
                      onClick={() => updateStatus(o.id, 'IN_DELIVERY')}
                      disabled={updating === o.id}
                      className="flex items-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition disabled:opacity-50"
                    >
                      <FiTruck className="h-3.5 w-3.5" />
                      En livraison
                    </button>
                  )}
                  {o.status === 'IN_DELIVERY' && (
                    <button
                      onClick={() => updateStatus(o.id, 'DELIVERED')}
                      disabled={updating === o.id}
                      className="flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-xl transition disabled:opacity-50"
                    >
                      <FiCheckCircle className="h-3.5 w-3.5" />
                      Livree
                    </button>
                  )}
                </div>
              </div>

              {/* Payment info */}
              {o.payment && (
                <div className="mt-2 pt-2 border-t border-gray-50 flex items-center gap-2">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    o.payment.status === 'COMPLETED' || o.payment.status === 'PAID'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {o.payment.status === 'COMPLETED' || o.payment.status === 'PAID' ? 'Paye' : 'Paiement en attente'}
                  </span>
                  {o.payment.method && (
                    <span className="text-[10px] text-gray-400">
                      {o.payment.method === 'CASH' ? 'Especes' : o.payment.method === 'NFC_SOUKCARD' ? 'Carte Souk.AI' : o.payment.method}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
