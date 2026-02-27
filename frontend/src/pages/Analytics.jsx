import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { analyticsAPI, inventoryAPI } from '../api/client'
import toast from 'react-hot-toast'

export default function Analytics() {
  const [chartData, setChartData] = useState([])
  const [alerts, setAlerts] = useState([])
  const [days, setDays] = useState(7)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      analyticsAPI.salesChart(days).catch(() => ({ data: [] })),
      inventoryAPI.alerts().catch(() => ({ data: [] })),
    ]).then(([chartRes, alertRes]) => {
      setChartData(chartRes.data)
      setAlerts(alertRes.data)
    }).finally(() => setLoading(false))
  }, [days])

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <div className="flex gap-2">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                days === d ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {d}j
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenu par jour</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `${v.toFixed(2)} MAD`} />
              <Bar dataKey="revenue" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Nombre de ventes par jour</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#059669" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Alertes stock bas ({alerts.length})</h3>
        {alerts.length === 0 ? (
          <p className="text-gray-400 text-center py-4">Aucune alerte - tous les stocks sont suffisants.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {alerts.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{a.product_name_ar}</p>
                  <p className="text-xs text-gray-500">{a.product_name_fr}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-orange-600">{a.quantity}</p>
                  <p className="text-xs text-gray-400">seuil: {a.reorder_threshold}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
