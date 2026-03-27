import { useState, useEffect } from 'react'
import {
  FiUsers, FiPackage, FiDollarSign, FiActivity, FiRefreshCw,
  FiTrendingUp, FiClock, FiServer, FiDatabase, FiMessageSquare, FiCpu,
  FiUserPlus, FiShoppingCart, FiAward
} from 'react-icons/fi'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts'
import client from '../api/client'
import toast from 'react-hot-toast'

const StatCard = ({ icon: Icon, label, value, sub, color = 'violet', large }) => {
  const colors = {
    violet: { bg: 'bg-violet-100', text: 'text-violet-600' },
    green: { bg: 'bg-green-100', text: 'text-green-600' },
    blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-600' },
    red: { bg: 'bg-red-100', text: 'text-red-600' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-600' },
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600' },
  }
  const c = colors[color] || colors.violet
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg transition-all">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 ${c.bg} rounded-xl flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${c.text}`} />
        </div>
        <div>
          <p className={`${large ? 'text-3xl' : 'text-2xl'} font-black text-gray-900`}>{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
      {sub && <p className="text-xs text-gray-400 mt-2">{sub}</p>}
    </div>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 text-white rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold text-gray-300 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-bold" style={{ color: p.color }}>
          {p.name === 'revenue' ? `${Number(p.value).toFixed(0)} MAD` : `${p.value} tx`}
        </p>
      ))}
    </div>
  )
}

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const fetchStats = async () => {
    setLoading(true)
    try {
      const res = await client.get('/admin/stats')
      setData(res.data)
      setLastRefresh(new Date())
    } catch {
      toast.error('Erreur chargement monitoring')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStats() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 animate-pulse" />
          <p className="text-sm text-gray-400 font-medium">Chargement monitoring...</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { merchants, transactions, revenue, counts, top_merchants, daily_activity, system } = data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Monitoring Fondateur</h1>
          <p className="text-sm text-gray-500 mt-0.5">Vue globale de la plateforme Souk.AI</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <FiClock className="h-3 w-3" /> {lastRefresh.toLocaleTimeString('fr-FR')}
          </span>
          <button
            onClick={fetchStats}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 text-sm font-medium transition-colors"
          >
            <FiRefreshCw className="h-4 w-4" /> Rafraichir
          </button>
        </div>
      </div>

      {/* Hero metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FiUsers} label="Commercants inscrits" value={merchants.total} sub={`+${merchants.new_this_month} ce mois`} color="violet" large />
        <StatCard icon={FiUserPlus} label="Actifs cette semaine" value={merchants.active_this_week} sub={`${merchants.new_this_week} nouveaux`} color="emerald" />
        <StatCard icon={FiDollarSign} label="CA aujourd'hui" value={`${revenue.today.toFixed(0)} MAD`} color="green" />
        <StatCard icon={FiDollarSign} label="CA ce mois" value={`${revenue.this_month.toFixed(0)} MAD`} color="blue" />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={FiShoppingCart} label="Transactions total" value={transactions.total} sub={`${transactions.today} aujourd'hui`} color="indigo" />
        <StatCard icon={FiActivity} label="Tx cette semaine" value={transactions.this_week} color="amber" />
        <StatCard icon={FiPackage} label="Produits" value={counts.products} color="orange" />
        <StatCard icon={FiAward} label="Clients / Employes" value={`${counts.customers} / ${counts.employees}`} color="red" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue chart */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Revenu 7 derniers jours</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={daily_activity} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="revenue" name="revenue" stroke="#7c3aed" fill="url(#revGrad)" strokeWidth={2.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Transactions chart */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Transactions 7 derniers jours</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={daily_activity} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="transactions" name="transactions" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top merchants + System status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top merchants */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2">
            <FiTrendingUp className="h-4 w-4 text-violet-600" />
            <h2 className="font-bold text-gray-900 text-sm">Top 5 commercants (30j)</h2>
          </div>
          <div className="divide-y">
            {top_merchants.length === 0 ? (
              <p className="p-5 text-sm text-gray-400 text-center">Aucune activite</p>
            ) : top_merchants.map((m, i) => (
              <div key={m.merchant_id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold ${
                    i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-600' : 'bg-gray-300'
                  }`}>
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{m.business_name}</p>
                    <p className="text-xs text-gray-400">{m.transactions} transactions</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-emerald-600">{m.revenue.toFixed(0)} MAD</span>
              </div>
            ))}
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-bold text-gray-900 text-sm mb-4">Etat du systeme</h2>
          <div className="space-y-3">
            {[
              { label: 'API Backend', icon: FiServer, status: system.api },
              { label: 'Base de donnees', icon: FiDatabase, status: system.database },
              { label: 'Bot WhatsApp', icon: FiMessageSquare, status: true },
              { label: 'Celery Workers', icon: FiCpu, status: true },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2.5">
                  <s.icon className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-700">{s.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${s.status ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className={`text-xs font-semibold ${s.status ? 'text-green-600' : 'text-red-600'}`}>
                    {s.status ? 'OK' : 'Down'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-gray-400">Derniere verif: {new Date(system.timestamp).toLocaleString('fr-FR')}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="font-bold text-gray-700">{merchants.total}</p>
                <p className="text-gray-400">Merchants</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="font-bold text-gray-700">{counts.products}</p>
                <p className="text-gray-400">Produits</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
