import { useState, useEffect } from 'react'
import { FiDollarSign, FiSearch } from 'react-icons/fi'
import { adminAPI } from '../api/client'
import toast from 'react-hot-toast'

const METHOD_LABELS = {
  CASH: { label: 'Especes', color: 'bg-green-100 text-green-700' },
  NFC_SOUKCARD: { label: 'Carte Souk.AI', color: 'bg-purple-100 text-purple-700' },
  NFC_BANK: { label: 'Carte bancaire', color: 'bg-blue-100 text-blue-700' },
}

const STATUS_LABELS = {
  COMPLETED: { label: 'Complete', color: 'bg-green-100 text-green-700' },
  PENDING: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700' },
  FAILED: { label: 'Echoue', color: 'bg-red-100 text-red-700' },
  REFUNDED: { label: 'Rembourse', color: 'bg-gray-100 text-gray-600' },
}

export default function AdminPayments() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    adminAPI.payments()
      .then(r => setPayments(r.data || []))
      .catch(() => toast.error('Erreur chargement paiements'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = payments.filter(p =>
    p.business_name.toLowerCase().includes(search.toLowerCase()) ||
    p.method.toLowerCase().includes(search.toLowerCase())
  )

  const totalAmount = payments.reduce((s, p) => s + p.amount, 0)
  const completed = payments.filter(p => p.status === 'COMPLETED')

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paiements</h1>
          <p className="text-sm text-gray-500 mt-1">{payments.length} paiements enregistres</p>
        </div>
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
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
          <p className="text-2xl font-black text-gray-900">{payments.length}</p>
          <p className="text-xs text-gray-500">Total paiements</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-2xl font-black text-green-600">{completed.length}</p>
          <p className="text-xs text-gray-500">Completes</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-2xl font-black text-purple-600">{totalAmount.toFixed(0)}</p>
          <p className="text-xs text-gray-500">Volume total (MAD)</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-2xl font-black text-blue-600">
            {payments.filter(p => p.method === 'NFC_SOUKCARD').length}
          </p>
          <p className="text-xs text-gray-500">Via Carte Souk.AI</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Marchand</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Montant</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Methode</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Statut</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => {
                const method = METHOD_LABELS[p.method] || { label: p.method, color: 'bg-gray-100 text-gray-600' }
                const status = STATUS_LABELS[p.status] || { label: p.status, color: 'bg-gray-100 text-gray-600' }
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.business_name}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{p.amount.toFixed(2)} MAD</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${method.color}`}>
                        {method.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(p.created_at).toLocaleString('fr-FR')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-400">Aucun paiement trouve</div>
        )}
      </div>
    </div>
  )
}
