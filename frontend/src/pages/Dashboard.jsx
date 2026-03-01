import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FiPackage, FiDollarSign, FiShoppingCart, FiAlertTriangle,
  FiTrendingUp, FiPlus, FiArrowRight, FiCheckCircle, FiCircle,
  FiMessageSquare, FiStar
} from 'react-icons/fi'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import StatsCard from '../components/StatsCard'
import { analyticsAPI, transactionsAPI, productsAPI, inventoryAPI, creditAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Dashboard() {
  const { merchant } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [chartData, setChartData] = useState([])
  const [recentTx, setRecentTx] = useState([])
  const [alerts, setAlerts] = useState([])
  const [creditScore, setCreditScore] = useState(null)
  const [loading, setLoading] = useState(true)

  const [showSaleModal, setShowSaleModal] = useState(false)
  const [products, setProducts] = useState([])
  const [saleForm, setSaleForm] = useState({ product_id: '', quantity: 1 })
  const [savingSale, setSavingSale] = useState(false)

  useEffect(() => {
    Promise.all([
      analyticsAPI.dashboard().catch(() => ({ data: {} })),
      analyticsAPI.salesChart(7).catch(() => ({ data: [] })),
      transactionsAPI.list(null, 5).catch(() => ({ data: [] })),
      inventoryAPI.alerts().catch(() => ({ data: [] })),
      creditAPI.score().catch(() => ({ data: null })),
    ]).then(([statsRes, chartRes, txRes, alertsRes, creditRes]) => {
      setStats(statsRes.data)
      setChartData(chartRes.data)
      setRecentTx(txRes.data.slice(0, 5))
      setAlerts(alertsRes.data)
      setCreditScore(creditRes.data)
    }).finally(() => setLoading(false))
  }, [])

  const openSaleModal = () => {
    productsAPI.list().then(r => {
      const priced = r.data.filter(p => p.unit_price > 0)
      setProducts(priced)
      setSaleForm({ product_id: priced[0]?.id || '', quantity: 1 })
      setShowSaleModal(true)
    }).catch(() => toast.error('Erreur chargement produits'))
  }

  const handleQuickSale = async (e) => {
    e.preventDefault()
    setSavingSale(true)
    try {
      const product = products.find(p => p.id === saleForm.product_id)
      await transactionsAPI.create({
        product_id: saleForm.product_id,
        quantity: Number(saleForm.quantity),
        unit_price: product?.unit_price,
        type: 'SALE',
        source: 'WEB',
      })
      toast.success(`✅ ${saleForm.quantity} × ${product?.name_fr || product?.name_ar}`)
      setShowSaleModal(false)
      analyticsAPI.dashboard().then(r => setStats(r.data)).catch(() => {})
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur')
    } finally {
      setSavingSale(false)
    }
  }

  const checklist = [
    { label: 'Compte créé', done: true },
    { label: 'Premier produit ajouté', done: (stats?.total_products || 0) > 0 },
    { label: 'Première vente enregistrée', done: (stats?.total_sales_month || 0) > 0 },
    { label: 'Bot WhatsApp testé', done: false, link: 'https://wa.me/212751649010?text=سلام' },
    { label: 'Stock configuré', done: alerts !== null },
  ]
  const checklistDone = checklist.filter(c => c.done).length
  const allDone = checklistDone === checklist.length

  const scoreColor = !creditScore ? 'gray'
    : creditScore.score >= 700 ? 'green'
    : creditScore.score >= 400 ? 'yellow' : 'red'
  const scoreLabel = !creditScore ? '—'
    : creditScore.score >= 700 ? 'Excellent'
    : creditScore.score >= 400 ? 'Bon' : 'À améliorer'

  const selectedProduct = products.find(p => p.id === saleForm.product_id)
  const saleTotal = (Number(saleForm.quantity) * (selectedProduct?.unit_price || 0)).toFixed(2)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">Tableau de bord</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">
            Bienvenue, {merchant?.business_name || 'commerçant'} 👋
          </p>
        </div>
        <button
          onClick={openSaleModal}
          className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors text-xs sm:text-sm font-medium shadow-sm flex-shrink-0"
        >
          <FiPlus className="h-4 w-4" />
          <span className="hidden xs:inline sm:inline">Vente rapide</span>
        </button>
      </div>

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatsCard title="Ventes auj." value={stats?.total_sales_today || 0} icon={FiShoppingCart} color="blue" />
        <StatsCard title="Revenu auj." value={`${(stats?.total_revenue_today || 0).toFixed(0)} MAD`} icon={FiDollarSign} color="green" />
        <StatsCard title="Produits" value={stats?.total_products || 0} icon={FiPackage} color="purple" />
        <StatsCard title="Stock bas" value={stats?.low_stock_count || 0} icon={FiAlertTriangle} color="orange" />
      </div>

      {/* ── Chart + Month summary ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">

        {/* Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900">Ventes — 7 derniers jours</h3>
            <FiTrendingUp className="h-4 w-4 text-purple-500 flex-shrink-0" />
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 11 }}
                formatter={(v) => [`${v} MAD`, 'Revenu']}
              />
              <Area type="monotone" dataKey="revenue" stroke="#7c3aed" fill="url(#grad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Month summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-5">
          <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-3">Résumé du mois</h3>
          <div className="space-y-0 divide-y divide-gray-50">
            <div className="flex justify-between items-center py-2.5">
              <span className="text-xs sm:text-sm text-gray-500">Ventes totales</span>
              <span className="font-bold text-gray-900 text-sm">{stats?.total_sales_month || 0}</span>
            </div>
            <div className="flex justify-between items-center py-2.5">
              <span className="text-xs sm:text-sm text-gray-500">Revenu total</span>
              <span className="font-bold text-green-600 text-sm">{(stats?.total_revenue_month || 0).toFixed(2)} MAD</span>
            </div>
            <div className="flex justify-between items-center py-2.5">
              <span className="text-xs sm:text-sm text-gray-500">Alertes stock</span>
              <span className={`font-bold text-sm ${alerts.length > 0 ? 'text-orange-500' : 'text-green-600'}`}>
                {alerts.length}
              </span>
            </div>
            {creditScore && (
              <div className="flex justify-between items-center py-2.5">
                <span className="text-xs sm:text-sm text-gray-500">Score crédit</span>
                <div className="flex items-center gap-1.5">
                  <span className={`font-bold text-sm ${
                    scoreColor === 'green' ? 'text-green-600' :
                    scoreColor === 'yellow' ? 'text-yellow-600' : 'text-red-600'
                  }`}>{creditScore.score}</span>
                  <span className="text-xs text-gray-400 hidden sm:inline">({scoreLabel})</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom: Transactions + Sidebar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">

        {/* Recent Transactions */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900">Dernières transactions</h3>
            <button
              onClick={() => navigate('/transactions')}
              className="text-xs text-purple-600 hover:underline font-medium flex items-center gap-1 flex-shrink-0"
            >
              Tout voir <FiArrowRight className="h-3 w-3" />
            </button>
          </div>

          {recentTx.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <FiShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Aucune transaction encore</p>
              <button onClick={openSaleModal} className="mt-2 text-xs text-purple-600 hover:underline">
                Enregistrer votre première vente →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentTx.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2.5 gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      tx.type === 'SALE' ? 'bg-green-100' : 'bg-blue-100'
                    }`}>
                      {tx.type === 'SALE'
                        ? <FiShoppingCart className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-600" />
                        : <FiPackage className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-600" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-gray-800 truncate">
                        {tx.product_name_fr || tx.product_name_ar || 'Produit'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {tx.quantity} unité(s) · {new Date(tx.created_at).toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs sm:text-sm font-semibold flex-shrink-0 ${tx.type === 'SALE' ? 'text-green-600' : 'text-blue-600'}`}>
                    {tx.type === 'SALE' ? '+' : ''}{Number(tx.total_amount || 0).toFixed(2)} MAD
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="flex flex-col gap-4">

          {/* Onboarding checklist */}
          {!allDone && (
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs sm:text-sm font-semibold text-purple-900">Démarrage rapide</h3>
                <span className="text-xs bg-purple-200 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                  {checklistDone}/{checklist.length}
                </span>
              </div>
              <div className="w-full bg-purple-200 rounded-full h-1.5 mb-3">
                <div
                  className="bg-purple-600 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${(checklistDone / checklist.length) * 100}%` }}
                />
              </div>
              <ul className="space-y-1.5">
                {checklist.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs">
                    {item.done
                      ? <FiCheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                      : <FiCircle className="h-3.5 w-3.5 text-purple-300 flex-shrink-0" />
                    }
                    {item.link && !item.done ? (
                      <a href={item.link} target="_blank" rel="noreferrer"
                        className="text-purple-700 hover:underline truncate">{item.label} →</a>
                    ) : (
                      <span className={`truncate ${item.done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{item.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Quick actions — 2-col grid on mobile, list on desktop */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-xs sm:text-sm font-semibold text-gray-900 mb-3">Actions rapides</h3>

            {/* Mobile: 2-column icon grid */}
            <div className="grid grid-cols-2 gap-2 lg:hidden">
              {[
                { label: 'Vente', icon: FiShoppingCart, color: 'purple', action: openSaleModal },
                { label: 'Produits', icon: FiPackage, color: 'blue', action: () => navigate('/products') },
                { label: 'Stock', icon: FiAlertTriangle, color: 'orange', action: () => navigate('/inventory') },
                { label: 'WhatsApp', icon: FiMessageSquare, color: 'green', href: 'https://wa.me/212751649010?text=مرحبا' },
                { label: 'Prévisions', icon: FiStar, color: 'indigo', action: () => navigate('/forecasts') },
              ].map(({ label, icon: Icon, color, action, href }) => {
                const colorMap = {
                  purple: 'bg-purple-50 text-purple-600 hover:bg-purple-100',
                  blue: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
                  orange: 'bg-orange-50 text-orange-600 hover:bg-orange-100',
                  green: 'bg-green-50 text-green-600 hover:bg-green-100',
                  indigo: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100',
                }
                const cls = `flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors ${colorMap[color]}`
                return href ? (
                  <a key={label} href={href} target="_blank" rel="noreferrer" className={cls}>
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{label}</span>
                  </a>
                ) : (
                  <button key={label} onClick={action} className={cls}>
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                )
              })}
            </div>

            {/* Desktop: list */}
            <div className="hidden lg:flex flex-col gap-1">
              {[
                { label: 'Enregistrer une vente', icon: FiShoppingCart, bg: 'hover:bg-purple-50', text: 'hover:text-purple-700', action: openSaleModal },
                { label: 'Gérer les produits', icon: FiPackage, bg: 'hover:bg-blue-50', text: 'hover:text-blue-700', action: () => navigate('/products') },
                { label: 'Vérifier le stock', icon: FiAlertTriangle, bg: 'hover:bg-orange-50', text: 'hover:text-orange-700', action: () => navigate('/inventory') },
                { label: 'Ouvrir le bot WhatsApp', icon: FiMessageSquare, bg: 'hover:bg-green-50', text: 'hover:text-green-700', href: 'https://wa.me/212751649010?text=مرحبا' },
                { label: 'Voir les prévisions', icon: FiStar, bg: 'hover:bg-indigo-50', text: 'hover:text-indigo-700', action: () => navigate('/forecasts') },
              ].map(({ label, icon: Icon, bg, text, action, href }) => {
                const cls = `w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left group ${bg}`
                return href ? (
                  <a key={label} href={href} target="_blank" rel="noreferrer" className={cls}>
                    <Icon className={`h-4 w-4 text-gray-400 group-hover:${text.split(':')[1]} flex-shrink-0`} />
                    <span className={`text-xs font-medium text-gray-600 group-${text}`}>{label}</span>
                  </a>
                ) : (
                  <button key={label} onClick={action} className={cls}>
                    <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span className={`text-xs font-medium text-gray-600 group-${text}`}>{label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Sale Modal ── */}
      {showSaleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:px-4">
          <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-5 sm:p-6 shadow-2xl">
            <h2 className="text-base sm:text-lg font-bold mb-4 text-gray-900">Vente rapide</h2>
            <form onSubmit={handleQuickSale} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Produit</label>
                <select
                  value={saleForm.product_id}
                  onChange={e => setSaleForm({ ...saleForm, product_id: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                  required
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name_fr || p.name_ar} — {Number(p.unit_price).toFixed(2)} MAD
                    </option>
                  ))}
                  {products.length === 0 && <option disabled>Aucun produit avec prix</option>}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Quantité</label>
                <input
                  type="number" min="1" step="1"
                  value={saleForm.quantity}
                  onChange={e => setSaleForm({ ...saleForm, quantity: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                  required
                />
              </div>
              {saleForm.product_id && (
                <div className="bg-purple-50 rounded-xl px-4 py-2.5 flex justify-between items-center">
                  <span className="text-xs text-purple-700">Total estimé</span>
                  <span className="text-sm font-bold text-purple-800">{saleTotal} MAD</span>
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowSaleModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-medium text-gray-700">
                  Annuler
                </button>
                <button type="submit" disabled={savingSale || products.length === 0}
                  className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 text-sm font-medium disabled:opacity-50 transition-colors">
                  {savingSale ? 'En cours...' : 'Confirmer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
