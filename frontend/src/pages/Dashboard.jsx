import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FiPackage, FiDollarSign, FiShoppingCart, FiAlertTriangle,
  FiTrendingUp, FiPlus, FiArrowRight, FiCheckCircle, FiCircle,
  FiMessageSquare, FiStar, FiZap, FiSearch, FiX
} from 'react-icons/fi'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import StatsCard from '../components/StatsCard'
import RamadanBanner from '../components/RamadanBanner'
import { analyticsAPI, transactionsAPI, productsAPI, inventoryAPI, creditAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

/* ── Custom chart tooltip ── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 text-white rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold text-gray-300 mb-1">{label}</p>
      <p className="font-bold text-violet-300 text-sm">{Number(payload[0]?.value || 0).toFixed(2)} MAD</p>
    </div>
  )
}

export default function Dashboard() {
  const { merchant } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [chartData, setChartData] = useState([])
  const [recentTx, setRecentTx] = useState([])
  const [alerts, setAlerts] = useState([])
  const [creditScore, setCreditScore] = useState(null)
  const [loading, setLoading] = useState(true)

  const [chartDays, setChartDays] = useState(7)

  const [showSaleModal, setShowSaleModal] = useState(false)
  const [products, setProducts] = useState([])
  const [saleForm, setSaleForm] = useState({ product_id: '', quantity: 1 })
  const [savingSale, setSavingSale] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef(null)

  useEffect(() => {
    Promise.all([
      analyticsAPI.dashboard().catch(() => ({ data: {} })),
      analyticsAPI.salesChart(chartDays).catch(() => ({ data: [] })),
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
  }, [chartDays])

  const openSaleModal = () => {
    productsAPI.list().then(r => {
      const priced = r.data.filter(p => p.unit_price > 0)
      setProducts(priced)
      setSaleForm({ product_id: '', quantity: 1 })
      setProductSearch('')
      setShowDropdown(false)
      setShowSaleModal(true)
      setTimeout(() => searchRef.current?.focus(), 100)
    }).catch(() => toast.error('Erreur chargement produits'))
  }

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 8)
    const q = productSearch.toLowerCase()
    return products.filter(p =>
      (p.name_fr || '').toLowerCase().includes(q) ||
      (p.name_ar || '').toLowerCase().includes(q) ||
      (p.barcode || '').includes(q)
    ).slice(0, 8)
  }, [products, productSearch])

  const selectedProduct = products.find(p => p.id === saleForm.product_id)

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
    { label: 'Bot WhatsApp testé', done: false, link: 'https://wa.me/212763576794?text=سلام' },
    { label: 'Stock configuré', done: (stats?.total_products || 0) >= 3 },
  ]
  const checklistDone = checklist.filter(c => c.done).length
  const allDone = checklistDone === checklist.length

  const scoreColor = !creditScore ? 'gray'
    : creditScore.score >= 700 ? 'green'
    : creditScore.score >= 400 ? 'yellow' : 'red'
  const scoreLabel = !creditScore ? '—'
    : creditScore.score >= 700 ? 'Excellent'
    : creditScore.score >= 400 ? 'Bon' : 'À améliorer'

  const saleTotal = (Number(saleForm.quantity) * (selectedProduct?.unit_price || 0)).toFixed(2)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 animate-pulse" />
          <p className="text-sm text-gray-400 font-medium">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 md:space-y-6">

      {/* ── Ramadan Banner ── */}
      <RamadanBanner />

      {/* ── Header row ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900">
            Bonjour, <span className="gradient-text">{merchant?.business_name || 'commerçant'}</span> 👋
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('fr-MA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={openSaleModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all text-sm font-semibold shadow-lg shadow-violet-200 flex-shrink-0"
        >
          <FiPlus className="h-4 w-4" />
          <span>Vente rapide</span>
        </button>
      </div>

      {/* ── Hero revenue card + stats grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Hero: Monthly revenue */}
        <div className="sm:col-span-2 lg:col-span-2 bg-gradient-to-br from-violet-600 to-indigo-700 rounded-2xl p-5 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-8 w-20 h-20 bg-white/5 rounded-full translate-y-1/2" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <FiDollarSign className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium text-violet-200">Revenu du mois</p>
            </div>
            <p className="text-4xl font-black tabular-nums">{(stats?.total_revenue_month || 0).toFixed(0)}</p>
            <p className="text-violet-300 font-semibold text-lg">MAD</p>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-violet-300">{stats?.total_sales_month || 0} ventes ce mois</p>
              <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-lg">
                <FiTrendingUp className="h-3 w-3 text-emerald-300" />
                <span className="text-xs font-semibold text-emerald-300">Actif</span>
              </div>
            </div>
          </div>
        </div>

        <StatsCard
          title="Ventes aujourd'hui"
          value={stats?.total_sales_today || 0}
          icon={FiShoppingCart}
          color="blue"
          subtitle={`${(stats?.total_revenue_today || 0).toFixed(0)} MAD aujourd'hui`}
        />
        <StatsCard
          title="Produits"
          value={stats?.total_products || 0}
          icon={FiPackage}
          color="purple"
          subtitle={`${stats?.low_stock_count || 0} en stock bas`}
        />
      </div>

      {/* ── Secondary stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatsCard title="Stock bas" value={stats?.low_stock_count || 0} icon={FiAlertTriangle} color="orange" />
        <StatsCard title="Revenu auj." value={`${(stats?.total_revenue_today || 0).toFixed(0)} MAD`} icon={FiZap} color="green" />
        {creditScore ? (
          <div className={`bg-white rounded-2xl border p-4 sm:p-5 hover:shadow-lg transition-all duration-300 ${
            scoreColor === 'green' ? 'border-emerald-100' : scoreColor === 'yellow' ? 'border-yellow-100' : 'border-red-100'
          }`}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Crédit Score</p>
            <p className={`text-2xl sm:text-3xl font-black mt-1.5 tabular-nums ${
              scoreColor === 'green' ? 'text-emerald-600' : scoreColor === 'yellow' ? 'text-yellow-600' : 'text-red-600'
            }`}>{creditScore.score}</p>
            <p className="text-xs text-gray-400 mt-1">{scoreLabel} · /1000</p>
          </div>
        ) : (
          <StatsCard title="Crédit Score" value="—" icon={FiStar} color="indigo" subtitle="Non calculé" />
        )}
        <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2">
            <FiMessageSquare className="h-4 w-4 text-white/80" />
            <p className="text-xs font-semibold text-emerald-100 uppercase tracking-wide">WhatsApp</p>
          </div>
          <a
            href="https://wa.me/212763576794?text=مرحبا"
            target="_blank"
            rel="noreferrer"
            className="text-white text-xs font-bold hover:text-emerald-100 transition-colors flex items-center gap-1"
          >
            Ouvrir le bot <FiArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* ── Chart + Summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Chart — wider */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Évolution des ventes</h3>
              <p className="text-xs text-gray-400 mt-0.5">{chartDays} derniers jours</p>
            </div>
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              {[7, 30, 90].map(d => (
                <button
                  key={d}
                  onClick={() => setChartDays(d)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    chartDays === d
                      ? 'bg-white text-violet-600 shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {d}j
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#7c3aed', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#7c3aed"
                fill="url(#revenueGrad)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: '#7c3aed', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Month summary */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Résumé du mois</h3>
          <div className="space-y-3">
            {[
              { label: 'Ventes totales', value: stats?.total_sales_month || 0, valueClass: 'text-gray-900 font-bold' },
              { label: 'Revenu total', value: `${(stats?.total_revenue_month || 0).toFixed(2)} MAD`, valueClass: 'text-emerald-600 font-bold' },
              { label: 'Alertes stock', value: alerts.length, valueClass: alerts.length > 0 ? 'text-orange-500 font-bold' : 'text-emerald-500 font-bold' },
            ].map(({ label, value, valueClass }) => (
              <div key={label} className="flex justify-between items-center py-2.5 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-500">{label}</span>
                <span className={`text-sm ${valueClass}`}>{value}</span>
              </div>
            ))}
            {creditScore && (
              <div className="flex justify-between items-center py-2.5">
                <span className="text-sm text-gray-500">Score crédit</span>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${
                    scoreColor === 'green' ? 'bg-emerald-500' :
                    scoreColor === 'yellow' ? 'bg-yellow-400' : 'bg-red-500'
                  }`} />
                  <span className={`text-sm font-bold ${
                    scoreColor === 'green' ? 'text-emerald-600' :
                    scoreColor === 'yellow' ? 'text-yellow-600' : 'text-red-600'
                  }`}>{creditScore.score}</span>
                  <span className="text-xs text-gray-400 hidden sm:inline">({scoreLabel})</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom: Transactions + Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Recent Transactions */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900">Dernières transactions</h3>
            <button
              onClick={() => navigate('/sales')}
              className="text-xs text-violet-600 hover:text-violet-700 font-semibold flex items-center gap-1 transition-colors"
            >
              Tout voir <FiArrowRight className="h-3 w-3" />
            </button>
          </div>

          {recentTx.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <FiShoppingCart className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-600">Aucune transaction encore</p>
              <p className="text-xs text-gray-400 mt-1">Enregistrez votre première vente</p>
              <button
                onClick={openSaleModal}
                className="mt-3 text-xs text-violet-600 hover:underline font-semibold"
              >
                Vente rapide →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentTx.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-3 gap-3 group hover:bg-gray-50/50 -mx-1 px-1 rounded-xl transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      tx.type === 'SALE' ? 'bg-emerald-100' : 'bg-blue-100'
                    }`}>
                      {tx.type === 'SALE'
                        ? <FiShoppingCart className="h-4 w-4 text-emerald-600" />
                        : <FiPackage className="h-4 w-4 text-blue-600" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {tx.product_name_fr || tx.product_name_ar || 'Produit'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {tx.quantity} unité(s) · {new Date(tx.created_at).toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold flex-shrink-0 ${tx.type === 'SALE' ? 'text-emerald-600' : 'text-blue-600'}`}>
                    {tx.type === 'SALE' ? '+' : ''}{Number(tx.total_amount || 0).toFixed(2)} MAD
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Onboarding + Quick actions */}
        <div className="flex flex-col gap-4">

          {/* Onboarding checklist */}
          {!allDone && (
            <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-2xl border border-violet-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900">Démarrage rapide</h3>
                <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-semibold">
                  {checklistDone}/{checklist.length}
                </span>
              </div>
              <div className="w-full bg-violet-100 rounded-full h-1.5 mb-3">
                <div
                  className="bg-gradient-to-r from-violet-500 to-purple-600 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${(checklistDone / checklist.length) * 100}%` }}
                />
              </div>
              <ul className="space-y-2">
                {checklist.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs">
                    {item.done
                      ? <FiCheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                      : <FiCircle className="h-3.5 w-3.5 text-violet-300 flex-shrink-0" />
                    }
                    {item.link && !item.done ? (
                      <a href={item.link} target="_blank" rel="noreferrer"
                        className="text-violet-700 hover:underline truncate font-medium">{item.label} →</a>
                    ) : (
                      <span className={`truncate ${item.done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{item.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Quick actions */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex-1">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Actions rapides</h3>
            <div className="grid grid-cols-2 gap-2 lg:hidden">
              {[
                { label: 'Vente', icon: FiShoppingCart, from: 'from-violet-500', to: 'to-purple-600', action: openSaleModal },
                { label: 'Produits', icon: FiPackage, from: 'from-blue-500', to: 'to-cyan-600', action: () => navigate('/products') },
                { label: 'Stock', icon: FiAlertTriangle, from: 'from-orange-500', to: 'to-amber-500', action: () => navigate('/inventory') },
                { label: 'WhatsApp', icon: FiMessageSquare, from: 'from-emerald-500', to: 'to-green-600', href: 'https://wa.me/212763576794?text=مرحبا' },
                { label: 'Prévisions', icon: FiTrendingUp, from: 'from-indigo-500', to: 'to-blue-600', action: () => navigate('/forecasts') },
              ].map(({ label, icon: Icon, from, to, action, href }) => {
                const cls = `flex flex-col items-center gap-1.5 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors`
                return href ? (
                  <a key={label} href={href} target="_blank" rel="noreferrer" className={cls}>
                    <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${from} ${to} flex items-center justify-center`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-xs font-medium text-gray-700">{label}</span>
                  </a>
                ) : (
                  <button key={label} onClick={action} className={cls}>
                    <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${from} ${to} flex items-center justify-center`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-xs font-medium text-gray-700">{label}</span>
                  </button>
                )
              })}
            </div>

            <div className="hidden lg:flex flex-col gap-1">
              {[
                { label: 'Enregistrer une vente', icon: FiShoppingCart, color: 'text-violet-600', bg: 'bg-violet-50', action: openSaleModal },
                { label: 'Gérer les produits', icon: FiPackage, color: 'text-blue-600', bg: 'bg-blue-50', action: () => navigate('/products') },
                { label: 'Vérifier le stock', icon: FiAlertTriangle, color: 'text-orange-500', bg: 'bg-orange-50', action: () => navigate('/inventory') },
                { label: 'Bot WhatsApp', icon: FiMessageSquare, color: 'text-emerald-600', bg: 'bg-emerald-50', href: 'https://wa.me/212763576794?text=مرحبا' },
                { label: 'Voir les prévisions', icon: FiTrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50', action: () => navigate('/forecasts') },
              ].map(({ label, icon: Icon, color, bg, action, href }) => {
                const cls = `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-gray-50 group text-left`
                return href ? (
                  <a key={label} href={href} target="_blank" rel="noreferrer" className={cls}>
                    <div className={`p-1.5 rounded-lg ${bg} flex-shrink-0`}>
                      <Icon className={`h-3.5 w-3.5 ${color}`} />
                    </div>
                    <span className="text-xs font-medium text-gray-600 group-hover:text-gray-900 transition-colors">{label}</span>
                  </a>
                ) : (
                  <button key={label} onClick={action} className={cls}>
                    <div className={`p-1.5 rounded-lg ${bg} flex-shrink-0`}>
                      <Icon className={`h-3.5 w-3.5 ${color}`} />
                    </div>
                    <span className="text-xs font-medium text-gray-600 group-hover:text-gray-900 transition-colors">{label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Sale Modal ── */}
      {showSaleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:px-4">
          <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-3xl p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-gray-900">Vente rapide</h2>
                <p className="text-xs text-gray-400 mt-0.5">Enregistrer une vente</p>
              </div>
              <button
                onClick={() => setShowSaleModal(false)}
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleQuickSale} className="space-y-4">
              <div className="relative">
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Produit</label>

                {/* Selected product pill */}
                {selectedProduct ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 border-2 border-violet-400 rounded-xl bg-violet-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-violet-800 truncate">
                        {selectedProduct.name_fr || selectedProduct.name_ar}
                      </p>
                      <p className="text-xs text-violet-500">{Number(selectedProduct.unit_price).toFixed(2)} MAD · stock: {selectedProduct.stock_quantity ?? '?'}</p>
                    </div>
                    <button type="button" onClick={() => { setSaleForm({ ...saleForm, product_id: '' }); setProductSearch(''); setTimeout(() => searchRef.current?.focus(), 50) }}
                      className="p-1 rounded-lg hover:bg-violet-200 text-violet-500 transition-colors flex-shrink-0">
                      <FiX className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <input
                      ref={searchRef}
                      type="text"
                      placeholder="Rechercher un produit..."
                      value={productSearch}
                      onChange={e => { setProductSearch(e.target.value); setShowDropdown(true) }}
                      onFocus={() => setShowDropdown(true)}
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none text-sm bg-gray-50 transition"
                      autoComplete="off"
                    />
                  </div>
                )}

                {/* Dropdown results */}
                {!selectedProduct && showDropdown && filteredProducts.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                    {filteredProducts.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={() => {
                          setSaleForm({ ...saleForm, product_id: p.id })
                          setProductSearch('')
                          setShowDropdown(false)
                        }}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-violet-50 transition-colors text-left border-b border-gray-50 last:border-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-800 truncate">{p.name_fr || p.name_ar}</p>
                          {p.name_ar && p.name_fr && <p className="text-xs text-gray-400 truncate">{p.name_ar}</p>}
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <p className="text-sm font-bold text-violet-600">{Number(p.unit_price).toFixed(2)} MAD</p>
                          <p className="text-xs text-gray-400">stock: {p.stock_quantity ?? '?'}</p>
                        </div>
                      </button>
                    ))}
                    {products.length > 8 && !productSearch && (
                      <p className="text-center text-xs text-gray-400 py-2">Tapez pour filtrer parmi {products.length} produits</p>
                    )}
                  </div>
                )}
                {!selectedProduct && showDropdown && productSearch && filteredProducts.length === 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-3 text-sm text-gray-400 text-center">
                    Aucun produit trouvé pour "{productSearch}"
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Quantité</label>
                <input
                  type="number" min="1" step="1"
                  value={saleForm.quantity}
                  onChange={e => setSaleForm({ ...saleForm, quantity: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none text-sm bg-gray-50 transition"
                  required
                />
              </div>
              {saleForm.product_id && (
                <div className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-xl px-4 py-3 flex justify-between items-center border border-violet-100">
                  <span className="text-xs font-medium text-violet-700">Total estimé</span>
                  <span className="text-base font-black text-violet-800">{saleTotal} MAD</span>
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowSaleModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingSale || products.length === 0}
                  className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-700 hover:to-purple-700 text-sm font-semibold disabled:opacity-50 transition-all shadow-lg shadow-violet-200"
                >
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
