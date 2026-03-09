import { useState, useEffect } from 'react'
import { FiTrendingUp, FiDollarSign, FiDownload } from 'react-icons/fi'
import { analyticsAPI } from '../api/client'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || '/api/v1'

export default function Profit() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const fetchProfit = () => {
    setLoading(true)
    analyticsAPI.profit(days)
      .then(r => setData(r.data))
      .catch(() => toast.error('Erreur chargement profits'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchProfit() }, [days])

  const handleExport = () => {
    const token = localStorage.getItem('token')
    window.open(`${API_URL}/export/profit?days=${days}&token=${token}`, '_blank')
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" /></div>
  }

  if (!data) return null

  const maxProfit = Math.max(...data.products.map(p => Math.abs(p.profit)), 1)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analyse des profits</h1>
          <p className="text-sm text-gray-500 mt-1">Marge et rentabilite par produit</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={days} onChange={e => setDays(parseInt(e.target.value))}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500">
            <option value={7}>7 jours</option>
            <option value={30}>30 jours</option>
            <option value={90}>90 jours</option>
            <option value={365}>1 an</option>
          </select>
          <button onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800">
            <FiDownload className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs text-gray-500">Chiffre d'affaires</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{data.total_revenue.toFixed(0)} <span className="text-sm font-normal text-gray-400">MAD</span></p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs text-gray-500">Cout total</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{data.total_cost.toFixed(0)} <span className="text-sm font-normal text-gray-400">MAD</span></p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs text-gray-500">Profit net</p>
          <p className={`text-2xl font-black mt-1 ${data.total_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {data.total_profit.toFixed(0)} <span className="text-sm font-normal">MAD</span>
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs text-gray-500">Marge moyenne</p>
          <p className={`text-2xl font-black mt-1 ${data.avg_margin >= 20 ? 'text-green-600' : data.avg_margin >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
            {data.avg_margin.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Products profit table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <FiTrendingUp className="h-4 w-4 text-violet-600" />
          <h2 className="font-semibold text-gray-900 text-sm">Profit par produit</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qte vendue</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CA</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cout</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Profit</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Marge</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Visual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.products.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400 text-sm">Aucune vente sur cette periode</td></tr>
              ) : data.products.map(p => (
                <tr key={p.product_id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <p className="text-sm font-medium text-gray-900">{p.name_fr}</p>
                    <p className="text-xs text-gray-400">{p.name_ar}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">{p.quantity_sold}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">{p.revenue.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">{p.cost_total.toFixed(2)}</td>
                  <td className={`px-4 py-3 text-right text-sm font-bold ${p.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {p.profit >= 0 ? '+' : ''}{p.profit.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      p.margin_pct >= 30 ? 'bg-green-100 text-green-700' :
                      p.margin_pct >= 15 ? 'bg-amber-100 text-amber-700' :
                      p.margin_pct >= 0 ? 'bg-orange-100 text-orange-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {p.margin_pct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${p.profit >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(Math.abs(p.profit) / maxProfit * 100, 100)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
