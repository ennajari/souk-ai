import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import client from '../api/client'

export default function Forecasts() {
  const [forecasts, setForecasts] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    client.get('/forecasts/')
      .then(r => {
        setForecasts(r.data)
        if (r.data.length > 0) setSelected(r.data[0])
      })
      .catch(() => setError('Erreur lors du chargement des previsions'))
      .finally(() => setLoading(false))
  }, [])

  const chartData = selected?.forecast?.map(f => ({
    date: new Date(f.date).toLocaleDateString('fr-MA', { weekday: 'short', day: 'numeric' }),
    Prévu: f.demand,
    Min: f.lower,
    Max: f.upper,
  })) || []

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" />
    </div>
  )

  if (error) return (
    <div className="text-center py-16 text-red-500">{error}</div>
  )

  if (forecasts.length === 0) return (
    <div className="text-center py-16 text-gray-500">
      <p className="text-lg font-medium">Aucun produit trouvé</p>
      <p className="text-sm mt-1">Ajoutez des produits et enregistrez des ventes pour obtenir des prévisions.</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Prévisions de Demande</h1>
        <p className="text-sm text-gray-500 mt-1">Prédictions sur 7 jours basées sur l'historique des ventes</p>
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {forecasts.map(f => (
          <button
            key={f.product_id}
            onClick={() => setSelected(f)}
            className={`text-left p-4 rounded-xl border-2 transition-all ${
              selected?.product_id === f.product_id
                ? 'border-brand-500 bg-brand-50'
                : 'border-gray-200 bg-white hover:border-brand-300'
            }`}
          >
            <p className="font-bold text-gray-900">{f.product_name_ar}</p>
            {f.product_name_fr && <p className="text-xs text-gray-500">{f.product_name_fr}</p>}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-gray-500">Stock actuel</p>
                <p className="text-lg font-semibold text-gray-800">{f.current_stock}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Demande 7j</p>
                <p className="text-lg font-semibold text-blue-600">{f.predicted_demand_7d}</p>
              </div>
            </div>
            {f.restock_quantity > 0 && (
              <div className="mt-2 bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-lg">
                ⚠ Commander {f.restock_quantity} unités
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Forecast chart */}
      {selected && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Prévisions — {selected.product_name_ar}
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorPrev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C2410C" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#C2410C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="Max" stroke="#F4C9B5" fill="none" strokeDasharray="4 2" dot={false} />
              <Area type="monotone" dataKey="Prévu" stroke="#C2410C" fill="url(#colorPrev)" strokeWidth={2} dot={{ r: 4 }} />
              <Area type="monotone" dataKey="Min" stroke="#F4C9B5" fill="none" strokeDasharray="4 2" dot={false} />
            </AreaChart>
          </ResponsiveContainer>

          {/* Summary row */}
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
            <div className="text-center">
              <p className="text-xs text-gray-500">Stock actuel</p>
              <p className="text-xl font-bold text-gray-800">{selected.current_stock}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Demande prévue (7j)</p>
              <p className="text-xl font-bold text-blue-600">{selected.predicted_demand_7d}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">À commander</p>
              <p className={`text-xl font-bold ${selected.restock_quantity > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                {selected.restock_quantity > 0 ? `+${selected.restock_quantity}` : '✓ OK'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
