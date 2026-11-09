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
import MoneyReportCard from '../components/MoneyReportCard'
import { analyticsAPI, transactionsAPI, productsAPI, inventoryAPI, revenueAPI, barcodeAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useMoney } from '../utils/money'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'

/* ── Custom chart tooltip ── */
function ChartTooltip({ active, payload, label }) {
  const money = useMoney()
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 text-white rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold text-gray-300 mb-1">{label}</p>
      <p className="font-bold text-brand-300 text-sm">{money(Number(payload[0]?.value || 0))}</p>
    </div>
  )
}

export default function Dashboard() {
  const { t, i18n } = useTranslation()
  const { merchant } = useAuth()
  const money = useMoney()
  const currency = merchant?.currency || 'MAD'
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [chartData, setChartData] = useState([])
  const [recentTx, setRecentTx] = useState([])
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [monthlyRevenue, setMonthlyRevenue] = useState(null)
  const [expiringCount, setExpiringCount] = useState(0)

  const [chartDays, setChartDays] = useState(7)

  const searchRef = useRef(null)

  useEffect(() => {
    Promise.all([
      analyticsAPI.dashboard().catch(() => ({ data: {} })),
      analyticsAPI.salesChart(chartDays).catch(() => ({ data: [] })),
      transactionsAPI.list(null, 5).catch(() => ({ data: [] })),
      inventoryAPI.alerts().catch(() => ({ data: [] })),
    ]).then(([statsRes, chartRes, txRes, alertsRes]) => {
      setStats(statsRes.data)
      setChartData(chartRes.data)
      setRecentTx(txRes.data.slice(0, 5))
      setAlerts(alertsRes.data)
    }).finally(() => setLoading(false))
    // Load monthly revenue + expiry count (non-blocking)
    revenueAPI.monthly(1).then(r => setMonthlyRevenue(r.data)).catch(() => {})
    barcodeAPI.expiring(3).then(r => setExpiringCount((r.data || []).length)).catch(() => {})
  }, [chartDays])

  // Selling happens at the till: one fast, atomic checkout instead of a second slower form here
  const openSaleModal = () => navigate('/pos')

  const checklist = [
    { label: t('dashboard.check.account'), done: true },
    { label: t('dashboard.check.product'), done: (stats?.total_products || 0) > 0 },
    { label: t('dashboard.check.sale'), done: (stats?.total_sales_month || 0) > 0 },
    { label: t('dashboard.check.bot'), done: false, link: 'https://wa.me/212763576794?text=سلام' },
    { label: t('dashboard.check.stock'), done: (stats?.total_products || 0) >= 3 },
  ]
  const checklistDone = checklist.filter(c => c.done).length
  const allDone = checklistDone === checklist.length



  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 animate-pulse" />
          <p className="text-sm text-gray-500 font-medium">{t('common.loading')}</p>
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
            {t('dashboard.hello')}, <span className="gradient-text">{merchant?.business_name || ''}</span> 👋
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString(i18n.language || 'fr', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={openSaleModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-600 to-brand-600 text-white rounded-xl hover:from-brand-700 hover:to-brand-700 transition-all text-sm font-semibold shadow-lg shadow-brand-200 flex-shrink-0"
        >
          <FiPlus className="h-4 w-4" />
          <span>{t('dashboard.quickSale')}</span>
        </button>
      </div>

      {/* ── Hero revenue card + stats grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Hero: Monthly revenue */}
        <div className="sm:col-span-2 lg:col-span-2 bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl p-5 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-8 w-20 h-20 bg-white/5 rounded-full translate-y-1/2" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <FiDollarSign className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium text-brand-200">{t('dashboard.monthlyRevenue')}</p>
            </div>
            <p className="text-4xl font-black tabular-nums">{(stats?.total_revenue_month || 0).toFixed(0)}</p>
            <p className="text-brand-300 font-semibold text-lg">{currency}</p>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-brand-300">{t('dashboard.salesThisMonth', { count: stats?.total_sales_month || 0 })}</p>
              <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-lg">
                <FiTrendingUp className="h-3 w-3 text-emerald-300" />
                <span className="text-xs font-semibold text-emerald-300">{t('dashboard.active')}</span>
              </div>
            </div>
          </div>
        </div>

        <StatsCard
          title={t('dashboard.todaySales')}
          value={stats?.total_sales_today || 0}
          icon={FiShoppingCart}
          color="blue"
          subtitle={t('dashboard.todayAmount', { amount: money(stats?.total_revenue_today || 0, 0) })}
        />
        <StatsCard
          title={t('dashboard.totalProducts')}
          value={stats?.total_products || 0}
          icon={FiPackage}
          color="purple"
          subtitle={t('dashboard.lowStockCount', { count: stats?.low_stock_count || 0 })}
        />
      </div>

      {/* ── Secondary stats ── */}
      <MoneyReportCard />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatsCard title={t('dashboard.lowStock')} value={stats?.low_stock_count || 0} icon={FiAlertTriangle} color="orange" />
        <StatsCard title={t('dashboard.todayRevenue')} subtitle={currency} value={Math.round(stats?.total_revenue_today || 0).toLocaleString()} icon={FiZap} color="green" />
        {monthlyRevenue && (
          <div className="bg-white rounded-2xl border border-blue-100 p-4 sm:p-5 hover:shadow-lg transition-all">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('dashboard.netProfitMonth')}</p>
            <p className={`text-2xl sm:text-3xl font-black mt-1.5 tabular-nums ${monthlyRevenue.net_revenue >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {monthlyRevenue.net_revenue.toFixed(0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">{currency} · {t('dashboard.afterCosts')}</p>
          </div>
        )}
        {expiringCount > 0 && (
          <div className="bg-white rounded-2xl border border-red-100 p-4 sm:p-5 hover:shadow-lg transition-all cursor-pointer" onClick={() => navigate('/products')}>
            <p className="text-xs font-medium text-red-500 uppercase tracking-wide">{t('dashboard.expiry')}</p>
            <p className="text-2xl sm:text-3xl font-black mt-1.5 text-red-600">{expiringCount}</p>
            <p className="text-xs text-gray-500 mt-1">{t('dashboard.expiringIn3')}</p>
          </div>
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
            {t('dashboard.openBot')} <FiArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* ── Chart + Summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Chart — wider */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900">{t('dashboard.salesChart')}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{t('dashboard.lastDays', { count: chartDays })}</p>
            </div>
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              {[7, 30, 90].map(d => (
                <button
                  key={d}
                  onClick={() => setChartDays(d)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    chartDays === d
                      ? 'bg-white text-brand-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-600'
                  }`}
                >
                  {t('dashboard.days', { count: d })}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C2410C" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#C2410C" stopOpacity={0} />
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
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#C2410C', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#C2410C"
                fill="url(#revenueGrad)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: '#C2410C', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Month summary */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">{t('dashboard.monthSummary')}</h3>
          <div className="space-y-3">
            {[
              { label: t('dashboard.totalSales'), value: stats?.total_sales_month || 0, valueClass: 'text-gray-900 font-bold' },
              { label: t('dashboard.totalRevenue'), value: `${money((stats?.total_revenue_month || 0))}`, valueClass: 'text-emerald-600 font-bold' },
              { label: t('dashboard.stockAlerts'), value: alerts.length, valueClass: alerts.length > 0 ? 'text-orange-500 font-bold' : 'text-emerald-500 font-bold' },
            ].map(({ label, value, valueClass }) => (
              <div key={label} className="flex justify-between items-center py-2.5 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-500">{label}</span>
                <span className={`text-sm ${valueClass}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom: Transactions + Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Recent Transactions */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900">{t('dashboard.recentTransactions')}</h3>
            <button
              onClick={() => navigate('/sales')}
              className="text-xs text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1 transition-colors"
            >
              Tout voir <FiArrowRight className="h-3 w-3" />
            </button>
          </div>

          {recentTx.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <FiShoppingCart className="h-6 w-6 text-gray-500" />
              </div>
              <p className="text-sm font-medium text-gray-600">{t('dashboard.noTx')}</p>
              <p className="text-xs text-gray-500 mt-1">{t('dashboard.noTxHint')}</p>
              <button
                onClick={openSaleModal}
                className="mt-3 text-xs text-brand-600 hover:underline font-semibold"
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
                        {tx.product_name_fr || tx.product_name_ar || t('customers.product')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {tx.quantity} unité(s) · {new Date(tx.created_at).toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold flex-shrink-0 ${tx.type === 'SALE' ? 'text-emerald-600' : 'text-blue-600'}`}>
                    {tx.type === 'SALE' ? '+' : ''}{money(Number(tx.total_amount || 0))}
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
            <div className="bg-gradient-to-br from-brand-50 to-brand-100 rounded-2xl border border-brand-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900">{t('dashboard.gettingStarted')}</h3>
                <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-semibold">
                  {checklistDone}/{checklist.length}
                </span>
              </div>
              <div className="w-full bg-brand-100 rounded-full h-1.5 mb-3">
                <div
                  className="bg-gradient-to-r from-brand-600 to-brand-700 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${(checklistDone / checklist.length) * 100}%` }}
                />
              </div>
              <ul className="space-y-2">
                {checklist.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs">
                    {item.done
                      ? <FiCheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                      : <FiCircle className="h-3.5 w-3.5 text-brand-300 flex-shrink-0" />
                    }
                    {item.link && !item.done ? (
                      <a href={item.link} target="_blank" rel="noreferrer"
                        className="text-brand-700 hover:underline truncate font-medium">{item.label} →</a>
                    ) : (
                      <span className={`truncate ${item.done ? 'text-gray-500 line-through' : 'text-gray-700'}`}>{item.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Quick actions */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex-1">
            <h3 className="text-sm font-bold text-gray-900 mb-3">{t('dashboard.quickActions')}</h3>
            <div className="grid grid-cols-2 gap-2 lg:hidden">
              {[
                { label: t('dashboard.qa.sale'), icon: FiShoppingCart, from: 'from-brand-500', to: 'to-brand-600', action: openSaleModal },
                { label: t('dashboard.qa.products'), icon: FiPackage, from: 'from-blue-500', to: 'to-cyan-600', action: () => navigate('/products') },
                { label: t('dashboard.qa.stock'), icon: FiAlertTriangle, from: 'from-orange-500', to: 'to-amber-500', action: () => navigate('/products') },
                { label: 'WhatsApp', icon: FiMessageSquare, from: 'from-emerald-500', to: 'to-green-600', href: 'https://wa.me/212763576794?text=مرحبا' },
                { label: t('dashboard.qa.forecasts'), icon: FiTrendingUp, from: 'from-brand-600', to: 'to-blue-600', action: () => navigate('/reports?tab=restock') },
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
                { label: t('dashboard.qa.recordSale'), icon: FiShoppingCart, color: 'text-brand-600', bg: 'bg-brand-50', action: openSaleModal },
                { label: t('dashboard.qa.manageProducts'), icon: FiPackage, color: 'text-blue-600', bg: 'bg-blue-50', action: () => navigate('/products') },
                { label: t('dashboard.qa.checkStock'), icon: FiAlertTriangle, color: 'text-orange-500', bg: 'bg-orange-50', action: () => navigate('/products') },
                { label: t('dashboard.qa.whatsappBot'), icon: FiMessageSquare, color: 'text-emerald-600', bg: 'bg-emerald-50', href: 'https://wa.me/212763576794?text=مرحبا' },
                { label: t('dashboard.qa.seeForecasts'), icon: FiTrendingUp, color: 'text-brand-700', bg: 'bg-brand-100', action: () => navigate('/reports?tab=restock') },
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

    </div>
  )
}
