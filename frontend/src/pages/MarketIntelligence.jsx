import { useState, useEffect } from 'react'
import { FiTrendingUp, FiBarChart2, FiDollarSign, FiUsers, FiPackage, FiArrowUp, FiArrowDown, FiMinus } from 'react-icons/fi'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import client from '../api/client'
import toast from 'react-hot-toast'

const trendIcon = { UP: <FiArrowUp className="text-green-500" />, DOWN: <FiArrowDown className="text-red-500" />, STABLE: <FiMinus className="text-gray-400" /> }
const recColor = { COMPETITIVE: 'text-green-600 bg-green-50', ABOVE_MARKET: 'text-red-600 bg-red-50', BELOW_MARKET: 'text-blue-600 bg-blue-50' }
const recLabel = { COMPETITIVE: 'Competitif', ABOVE_MARKET: 'Au-dessus du marche', BELOW_MARKET: 'En dessous du marche' }

export default function MarketIntelligence() {
  const [tab, setTab] = useState('overview')
  const [overview, setOverview] = useState(null)
  const [benchmark, setBenchmark] = useState(null)
  const [trending, setTrending] = useState([])
  const [prices, setPrices] = useState([])
  const [trends, setTrends] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      client.get('/market/overview').then(r => setOverview(r.data)).catch(() => {}),
      client.get('/market/benchmark').then(r => setBenchmark(r.data)).catch(() => {}),
      client.get('/market/trending-products').then(r => setTrending(r.data)).catch(() => {}),
      client.get('/market/price-benchmark').then(r => setPrices(r.data)).catch(() => {}),
      client.get('/market/trends').then(r => setTrends(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-12 text-gray-400">Chargement de l'intelligence marche...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Intelligence Marche</h1>
        <p className="text-gray-500 text-sm">Analyse comparative et tendances du marche marocain</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit flex-wrap">
        {[['overview', 'Vue globale', FiBarChart2], ['benchmark', 'Mon positionnement', FiUsers], ['trending', 'Tendances', FiTrendingUp], ['prices', 'Prix', FiDollarSign]].map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === key ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Commercants actifs" value={overview.total_merchants} icon={<FiUsers />} />
            <StatCard label="Produits" value={overview.total_products} icon={<FiPackage />} />
            <StatCard label="Transactions (30j)" value={overview.total_transactions_30d} icon={<FiBarChart2 />} />
            <StatCard label="Volume (30j)" value={`${(overview.total_volume_30d / 1000).toFixed(1)}k MAD`} icon={<FiDollarSign />} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold mb-3">Categories populaires</h3>
              {overview.top_categories.map((c, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
                  <span className="text-sm">{c.category}</span>
                  <span className="text-sm font-medium text-purple-600">{c.count} commercants</span>
                </div>
              ))}
            </div>

            {trends.length > 0 && (
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold mb-3">Evolution du volume (8 semaines)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`${v} MAD`, 'Volume']} />
                    <Area type="monotone" dataKey="total_volume" stroke="#7C3AED" fill="#7C3AED" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {overview.avg_basket_size > 0 && (
            <div className="bg-purple-50 rounded-xl border border-purple-200 p-5">
              <p className="text-sm text-purple-600 font-medium">Panier moyen du marche</p>
              <p className="text-3xl font-bold text-purple-700">{overview.avg_basket_size.toFixed(2)} MAD</p>
            </div>
          )}
        </div>
      )}

      {/* Benchmark Tab */}
      {tab === 'benchmark' && benchmark && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-lg">Votre positionnement</h3>
                <p className="text-sm text-gray-500">Categorie: {benchmark.category} ({benchmark.total_merchants_in_category} commercants)</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Percentile</p>
                <p className="text-3xl font-bold text-purple-600">Top {(100 - benchmark.your_rank_percentile).toFixed(0)}%</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <CompareCard label="Chiffre d'affaires (30j)" yours={benchmark.your_revenue_30d} avg={benchmark.avg_revenue_30d} unit="MAD" />
              <CompareCard label="Transactions (30j)" yours={benchmark.your_transactions_30d} avg={benchmark.avg_transactions_30d} unit="" />
              <CompareCard label="Panier moyen" yours={benchmark.your_avg_basket} avg={benchmark.avg_basket} unit="MAD" />
            </div>
          </div>
        </div>
      )}

      {/* Trending Tab */}
      {tab === 'trending' && (
        <div className="bg-white rounded-xl border overflow-x-auto">
          {trending.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <FiTrendingUp size={48} className="mx-auto mb-3 opacity-30" />
              <p>Pas assez de donnees</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 text-gray-600 text-sm">
                <tr>
                  <th className="text-left px-4 py-3">Produit</th>
                  <th className="text-left px-4 py-3">Prix moyen</th>
                  <th className="text-left px-4 py-3">Ventes (30j)</th>
                  <th className="text-left px-4 py-3">Commercants</th>
                  <th className="text-left px-4 py-3">Tendance</th>
                  <th className="text-left px-4 py-3">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {trending.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{p.product_name}</td>
                    <td className="px-4 py-3">{p.avg_price.toFixed(2)} MAD</td>
                    <td className="px-4 py-3">{p.total_sold_30d}</td>
                    <td className="px-4 py-3">{p.merchants_selling}</td>
                    <td className="px-4 py-3">{trendIcon[p.price_trend]}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${Math.min(100, p.demand_score)}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{p.demand_score}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Prices Tab */}
      {tab === 'prices' && (
        <div className="bg-white rounded-xl border overflow-x-auto">
          {prices.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <FiDollarSign size={48} className="mx-auto mb-3 opacity-30" />
              <p>Ajoutez des produits pour comparer les prix</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 text-gray-600 text-sm">
                <tr>
                  <th className="text-left px-4 py-3">Produit</th>
                  <th className="text-left px-4 py-3">Votre prix</th>
                  <th className="text-left px-4 py-3">Moy. marche</th>
                  <th className="text-left px-4 py-3">Min</th>
                  <th className="text-left px-4 py-3">Max</th>
                  <th className="text-left px-4 py-3">Positionnement</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {prices.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{p.product_name}</td>
                    <td className="px-4 py-3 font-semibold">{p.your_price.toFixed(2)} MAD</td>
                    <td className="px-4 py-3">{p.avg_market_price.toFixed(2)} MAD</td>
                    <td className="px-4 py-3 text-green-600">{p.min_price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-red-600">{p.max_price.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${recColor[p.recommendation] || ''}`}>
                        {recLabel[p.recommendation]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center gap-2 text-gray-400 mb-1">{icon}<span className="text-sm">{label}</span></div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

function CompareCard({ label, yours, avg, unit }) {
  const diff = avg > 0 ? ((yours - avg) / avg * 100).toFixed(0) : 0
  const isAbove = yours >= avg
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <p className="text-sm text-gray-500 mb-2">{label}</p>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xl font-bold text-gray-900">{typeof yours === 'number' ? yours.toFixed(yours > 100 ? 0 : 2) : yours} {unit}</p>
          <p className="text-xs text-gray-400">Moy: {typeof avg === 'number' ? avg.toFixed(avg > 100 ? 0 : 2) : avg} {unit}</p>
        </div>
        <span className={`text-sm font-medium ${isAbove ? 'text-green-600' : 'text-red-600'}`}>
          {isAbove ? '+' : ''}{diff}%
        </span>
      </div>
    </div>
  )
}
