import { useState, useEffect } from 'react'
import { FiUsers, FiSearch, FiPackage, FiDollarSign, FiCalendar } from 'react-icons/fi'
import { adminAPI } from '../api/client'
import toast from 'react-hot-toast'

export default function AdminMerchants() {
  const [merchants, setMerchants] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    adminAPI.merchants()
      .then(r => setMerchants(r.data || []))
      .catch(() => toast.error('Erreur chargement marchands'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = merchants.filter(m =>
    m.business_name.toLowerCase().includes(search.toLowerCase()) ||
    m.phone_number.includes(search)
  )

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marchands</h1>
          <p className="text-sm text-gray-500 mt-1">{merchants.length} comptes enregistres</p>
        </div>
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500 w-64"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-2xl font-black text-gray-900">{merchants.length}</p>
          <p className="text-xs text-gray-500">Total marchands</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-2xl font-black text-green-600">{merchants.filter(m => m.account_type === 'MERCHANT').length}</p>
          <p className="text-xs text-gray-500">Marchands</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-2xl font-black text-blue-600">{merchants.filter(m => m.account_type === 'SUPPLIER').length}</p>
          <p className="text-xs text-gray-500">Fournisseurs</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-2xl font-black text-brand-600">
            {(merchants.reduce((sum, m) => sum + m.revenue_30d, 0) / 1000).toFixed(1)}K
          </p>
          <p className="text-xs text-gray-500">CA 30j (MAD)</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Commerce</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Telephone</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Produits</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">TX 30j</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">CA 30j</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Score</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Inscription</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(m => (
                <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{m.business_name}</p>
                    <p className="text-xs text-gray-500">{m.business_category}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{m.phone_number}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      m.account_type === 'SUPPLIER' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {m.account_type === 'SUPPLIER' ? 'Fournisseur' : 'Marchand'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{m.products}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{m.transactions_30d}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{m.revenue_30d.toFixed(0)} MAD</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-bold ${m.credit_score >= 700 ? 'text-green-600' : m.credit_score >= 500 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {m.credit_score}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(m.created_at).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-500">Aucun marchand trouve</div>
        )}
      </div>
    </div>
  )
}
