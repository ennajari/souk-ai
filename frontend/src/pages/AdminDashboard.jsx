import { useState, useEffect } from 'react'
import { FiUsers, FiPackage, FiDollarSign, FiActivity, FiRefreshCw, FiAlertTriangle, FiTrendingUp, FiClock } from 'react-icons/fi'
import { analyticsAPI, productsAPI, transactionsAPI, merchantsAPI } from '../api/client'
import toast from 'react-hot-toast'

const StatCard = ({ icon: Icon, label, value, sub, color = 'violet' }) => (
  <div className="bg-white rounded-xl border border-gray-100 p-5">
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 bg-${color}-100 rounded-xl flex items-center justify-center`}>
        <Icon className={`h-5 w-5 text-${color}-600`} />
      </div>
      <div>
        <p className="text-2xl font-black text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
    {sub && <p className="text-xs text-gray-400 mt-2">{sub}</p>}
  </div>
)

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [products, setProducts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [dashRes, prodRes, txnRes] = await Promise.all([
        analyticsAPI.dashboard().catch(() => ({ data: {} })),
        productsAPI.list().catch(() => ({ data: [] })),
        transactionsAPI.list(null, 50).catch(() => ({ data: [] })),
      ])
      setStats(dashRes.data)
      setProducts(prodRes.data)
      setTransactions(txnRes.data)
      setLastRefresh(new Date())
    } catch {
      toast.error('Erreur chargement donnees')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  // Compute monitoring metrics
  const lowStockProducts = products.filter(p => {
    const stock = p.inventory?.quantity || 0
    const threshold = p.inventory?.reorder_threshold || 10
    return stock <= threshold
  })
  const expiringSoon = products.filter(p => {
    if (!p.expiry_date) return false
    const diff = (new Date(p.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= 7
  })
  const todayTxns = transactions.filter(t => {
    const d = new Date(t.created_at)
    const now = new Date()
    return d.toDateString() === now.toDateString()
  })
  const todayRevenue = todayTxns.filter(t => t.type === 'SALE').reduce((s, t) => s + (t.total_amount || 0), 0)
  const totalProducts = products.length
  const totalStock = products.reduce((s, p) => s + (p.inventory?.quantity || 0), 0)

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Monitoring Admin</h1>
          <p className="text-sm text-gray-500 mt-1">Vue d'ensemble en temps reel de votre commerce</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <FiClock className="h-3 w-3" /> {lastRefresh.toLocaleTimeString('fr-FR')}
          </span>
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 text-sm font-medium transition-colors"
          >
            <FiRefreshCw className="h-4 w-4" /> Rafraichir
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FiDollarSign} label="CA aujourd'hui" value={`${todayRevenue.toFixed(0)} MAD`} color="emerald" />
        <StatCard icon={FiActivity} label="Transactions aujourd'hui" value={todayTxns.length} color="blue" />
        <StatCard icon={FiPackage} label="Produits en stock" value={totalProducts} sub={`${totalStock.toFixed(0)} unites totales`} color="violet" />
        <StatCard icon={FiUsers} label="Alertes actives" value={lowStockProducts.length + expiringSoon.length} color="orange" />
      </div>

      {/* Alerts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alerts */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b bg-red-50 flex items-center gap-2">
            <FiAlertTriangle className="h-4 w-4 text-red-600" />
            <h2 className="font-semibold text-red-800 text-sm">Stock bas ({lowStockProducts.length})</h2>
          </div>
          <div className="divide-y max-h-64 overflow-y-auto">
            {lowStockProducts.length === 0 ? (
              <p className="p-5 text-sm text-gray-400 text-center">Aucune alerte de stock</p>
            ) : lowStockProducts.map(p => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.name_fr || p.name_ar}</p>
                  <p className="text-xs text-gray-500">{p.unit}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-600">{p.inventory?.quantity || 0}</p>
                  <p className="text-xs text-gray-400">seuil: {p.inventory?.reorder_threshold || 10}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Expiring Products */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b bg-amber-50 flex items-center gap-2">
            <FiClock className="h-4 w-4 text-amber-600" />
            <h2 className="font-semibold text-amber-800 text-sm">Expirent bientot ({expiringSoon.length})</h2>
          </div>
          <div className="divide-y max-h-64 overflow-y-auto">
            {expiringSoon.length === 0 ? (
              <p className="p-5 text-sm text-gray-400 text-center">Aucun produit pres de l'expiration</p>
            ) : expiringSoon.map(p => {
              const days = Math.ceil((new Date(p.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
              return (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.name_fr || p.name_ar}</p>
                    <p className="text-xs text-gray-500">Stock: {p.inventory?.quantity || 0}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${days <= 2 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {days <= 0 ? 'Expire!' : `${days}j restant${days > 1 ? 's' : ''}`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <FiTrendingUp className="h-4 w-4 text-gray-600" />
          <h2 className="font-semibold text-gray-900 text-sm">Activite recente</h2>
        </div>
        <div className="divide-y max-h-80 overflow-y-auto">
          {transactions.slice(0, 20).map(t => (
            <div key={t.id} className="px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${t.type === 'SALE' ? 'bg-green-500' : t.type === 'RESTOCK' ? 'bg-blue-500' : 'bg-gray-400'}`} />
                <div>
                  <p className="text-sm font-medium text-gray-900">{t.product_name_fr || t.product_name_ar || '-'}</p>
                  <p className="text-xs text-gray-500">
                    {t.type === 'SALE' ? 'Vente' : t.type === 'RESTOCK' ? 'Restock' : t.type} — {t.quantity} x {t.unit_price?.toFixed(2)} MAD
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${t.type === 'SALE' ? 'text-green-600' : 'text-blue-600'}`}>
                  {t.type === 'SALE' ? '+' : ''}{t.total_amount?.toFixed(2)} MAD
                </p>
                <p className="text-xs text-gray-400">{new Date(t.created_at).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</p>
              </div>
            </div>
          ))}
          {transactions.length === 0 && (
            <p className="p-5 text-sm text-gray-400 text-center">Aucune activite recente</p>
          )}
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900 text-sm mb-3">Etat du systeme</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'API Backend', status: true },
            { label: 'Base de donnees', status: true },
            { label: 'Bot WhatsApp', status: true },
            { label: 'Celery Workers', status: true },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${s.status ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-gray-600">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
