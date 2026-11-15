import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'
import { useMoney } from '../utils/money'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts'
import {
  FiTrendingUp, FiTrendingDown, FiDollarSign, FiShoppingCart,
  FiPackage, FiPercent, FiCalendar, FiBarChart2
} from 'react-icons/fi'
import { analyticsAPI, transactionsAPI } from '../api/client'

// Distinct hues for categories (brand terracotta first); never two shades of the same hue side by side
const COLORS = ['#C2410C', '#0F766E', '#D97706', '#1D4ED8', '#9F1239', '#4D7C0F']

function KpiCard({ title, value, sub, icon: Icon, trend, color = 'violet' }) {
  const colors = {
    violet: { bg: 'bg-brand-50', text: 'text-brand-600', icon: 'text-brand-500' },
    cyan:   { bg: 'bg-cyan-50',   text: 'text-cyan-600',   icon: 'text-cyan-500' },
    green:  { bg: 'bg-emerald-50',text: 'text-emerald-600',icon: 'text-emerald-500' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600', icon: 'text-orange-500' },
  }
  const c = colors[color] || colors.violet
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
        <div className={`p-2 rounded-xl ${c.bg}`}>
          <Icon className={`h-4 w-4 ${c.icon}`} />
        </div>
      </div>
      <p className={`text-2xl font-black ${c.text} tabular-nums`}>{value}</p>
      <div className="flex items-center gap-1.5 mt-1.5">
        {trend !== undefined && (
          trend >= 0
            ? <FiTrendingUp className="h-3 w-3 text-emerald-500" />
            : <FiTrendingDown className="h-3 w-3 text-red-400" />
        )}
        <p className="text-xs text-gray-500">{sub}</p>
      </div>
    </div>
  )
}

function CustomTooltip({ active, payload, label }) {
  const { t } = useTranslation()
  const money = useMoney()
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 text-white rounded-xl px-3 py-2 shadow-xl text-xs border border-white/10">
      <p className="text-gray-500 mb-1 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-bold" style={{ color: p.color }}>
          {p.name === 'revenue' ? money(p.value, 0) : t('reportsPage.salesCount', { count: p.value })}
        </p>
      ))}
    </div>
  )
}

export default function Analytics() {
  const { t } = useTranslation()
  const money = useMoney()
  const { merchant } = useAuth()
  const [chartData, setChartData]     = useState([])
  const [topProducts, setTopProducts] = useState([])
  const [days, setDays]               = useState(7)
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      analyticsAPI.salesChart(days).catch(() => ({ data: [] })),
      transactionsAPI.list(null, 100).catch(() => ({ data: [] })),
    ]).then(([chartRes, txRes]) => {
      setChartData(chartRes.data)

      // Build top products from transactions
      const txs = Array.isArray(txRes.data) ? txRes.data : []
      const sales = txs.filter(t => t.type === 'SALE')
      const map = {}
      sales.forEach(t => {
        const name = t.product_name_fr || t.product_name_ar || 'Inconnu'
        if (!map[name]) map[name] = { name, qty: 0, revenue: 0 }
        map[name].qty += t.quantity || 0
        map[name].revenue += Number(t.total_amount || 0)
      })
      const sorted = Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 6)
      setTopProducts(sorted)
    }).finally(() => setLoading(false))
  }, [days])

  // Computed KPIs from chartData
  const totalRevenue = chartData.reduce((s, d) => s + (d.revenue || 0), 0)
  const totalSales   = chartData.reduce((s, d) => s + (d.count || 0), 0)
  const avgBasket    = totalSales > 0 ? totalRevenue / totalSales : 0
  const bestDay      = chartData.reduce((best, d) => d.revenue > (best?.revenue || 0) ? d : best, null)

  // Week-over-week from chart (last 7 vs prev 7 if 14d selected)
  const half = Math.floor(chartData.length / 2)
  const thisHalf = chartData.slice(half).reduce((s, d) => s + (d.revenue || 0), 0)
  const prevHalf = chartData.slice(0, half).reduce((s, d) => s + (d.revenue || 0), 0)
  const growth = prevHalf > 0 ? ((thisHalf - prevHalf) / prevHalf) * 100 : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 animate-pulse" />
          <p className="text-sm text-gray-500">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">{t('reports.sales')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('reportsPage.salesSubtitle')}</p>
        </div>
        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
          {[
            { d: 7,  label: t('dashboard.days', { count: 7 }) },
            { d: 14, label: t('dashboard.days', { count: 14 }) },
            { d: 30, label: t('dashboard.days', { count: 30 }) },
          ].map(({ d, label }) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                days === d
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title={t('dashboard.totalRevenue')}
          value={money(totalRevenue, 0)}
          sub={t('dashboard.lastDays', { count: days })}
          icon={FiDollarSign}
          color="violet"
        />
        <KpiCard
          title={t('dashboard.totalSales')}
          value={totalSales}
          sub={t('dashboard.lastDays', { count: days })}
          icon={FiShoppingCart}
          color="cyan"
        />
        <KpiCard
          title={t('coach.avgBasket')}
          value={money(avgBasket, 0)}
          sub={t('reportsPage.perSale')}
          icon={FiPercent}
          color="green"
        />
        <KpiCard
          title={t('reportsPage.growth')}
          value={`${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`}
          sub={days >= 14 ? t('reportsPage.vsPrevious') : t('reportsPage.notEnoughData')}
          icon={FiTrendingUp}
          trend={growth}
          color="orange"
        />
      </div>

      {/* ── Charts row 1 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Revenue area chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-gray-900">{t('reportsPage.dailyRevenue')}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{t('reportsPage.perDay', { currency: merchant?.currency || 'MAD' })}</p>
            </div>
            {bestDay && (
              <div className="text-right">
                <p className="text-xs text-gray-500">{t('reportsPage.bestDay')}</p>
                <p className="text-xs font-bold text-brand-600">{bestDay.date} · {money(bestDay.revenue, 0)}</p>
              </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C2410C" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#C2410C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#C2410C', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area type="monotone" dataKey="revenue" stroke="#C2410C" fill="url(#revGrad)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#C2410C', strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Volume ventes */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="mb-5">
            <h3 className="text-sm font-bold text-gray-900">{t('reportsPage.salesVolume')}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{t('reportsPage.salesPerDay')}</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="count" fill="#0F766E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Charts row 2 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Top produits — bar horizontal */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-5">
            <FiPackage className="h-4 w-4 text-brand-500" />
            <h3 className="text-sm font-bold text-gray-900">{t('reportsPage.topProducts')}</h3>
          </div>
          {topProducts.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-sm">{t('reportsPage.noSales')}</div>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => {
                const max = topProducts[0]?.revenue || 1
                const pct = (p.revenue / max) * 100
                return (
                  <div key={p.name}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700 truncate max-w-[55%]">{p.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">{p.qty} unités</span>
                        <span className="text-sm font-bold text-gray-900">{money(p.revenue, 0)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Répartition top produits — pie */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-5">
            <FiBarChart2 className="h-4 w-4 text-cyan-500" />
            <h3 className="text-sm font-bold text-gray-900">{t('reportsPage.revenueSplit')}</h3>
          </div>
          {topProducts.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-sm">{t('reportsPage.noSales')}</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={topProducts}
                  dataKey="revenue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {topProducts.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => money(v, 0)} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span style={{ fontSize: 11, color: '#6b7280' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Tendance détaillée ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <FiCalendar className="h-4 w-4 text-brand-500" />
            <h3 className="text-sm font-bold text-gray-900">{t('reportsPage.combined')}</h3>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="rev" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="cnt" orientation="right" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line yAxisId="rev" type="monotone" dataKey="revenue" stroke="#C2410C" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} name="revenue" />
            <Line yAxisId="cnt" type="monotone" dataKey="count"   stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name="count" strokeDasharray="5 3" />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex gap-5 mt-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-4 h-0.5 bg-brand-600 inline-block rounded" />
            {t('reportsPage.revenue')} ({merchant?.currency || 'MAD'})
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-4 h-0.5 bg-emerald-500 inline-block rounded" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #10b981 0, #10b981 5px, transparent 5px, transparent 8px)' }} />
            {t('reportsPage.salesCountLabel')}
          </div>
        </div>
      </div>

    </div>
  )
}
