import { useState, useEffect } from 'react'
import { FiPackage, FiDollarSign, FiShoppingCart, FiAlertTriangle } from 'react-icons/fi'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import StatsCard from '../components/StatsCard'
import { analyticsAPI } from '../api/client'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      analyticsAPI.dashboard().catch(() => ({ data: {} })),
      analyticsAPI.salesChart(7).catch(() => ({ data: [] })),
    ]).then(([statsRes, chartRes]) => {
      setStats(statsRes.data)
      setChartData(chartRes.data)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Ventes aujourd'hui"
          value={stats?.total_sales_today || 0}
          icon={FiShoppingCart}
          color="blue"
        />
        <StatsCard
          title="Revenu aujourd'hui"
          value={`${(stats?.total_revenue_today || 0).toFixed(2)} MAD`}
          icon={FiDollarSign}
          color="green"
        />
        <StatsCard
          title="Total produits"
          value={stats?.total_products || 0}
          icon={FiPackage}
          color="purple"
        />
        <StatsCard
          title="Stock bas"
          value={stats?.low_stock_count || 0}
          icon={FiAlertTriangle}
          color="orange"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ventes - 7 derniers jours</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area type="monotone" dataKey="revenue" stroke="#7c3aed" fill="#ede9fe" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Resume du mois</h3>
          <div className="space-y-4 mt-6">
            <div className="flex justify-between items-center py-3 border-b">
              <span className="text-gray-600">Ventes totales</span>
              <span className="font-bold text-gray-900">{stats?.total_sales_month || 0}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b">
              <span className="text-gray-600">Revenu total</span>
              <span className="font-bold text-green-600">{(stats?.total_revenue_month || 0).toFixed(2)} MAD</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-gray-600">Alertes stock</span>
              <span className={`font-bold ${stats?.low_stock_count > 0 ? 'text-orange-500' : 'text-green-600'}`}>
                {stats?.low_stock_count || 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
