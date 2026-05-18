import { useState, useEffect } from 'react'
import { FiPercent, FiCheck, FiX } from 'react-icons/fi'
import { adminAPI } from '../api/client'
import toast from 'react-hot-toast'

const STATUS_MAP = {
  PENDING: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700' },
  APPROVED: { label: 'Approuve', color: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Refuse', color: 'bg-red-100 text-red-700' },
  DISBURSED: { label: 'Decaisse', color: 'bg-blue-100 text-blue-700' },
}

export default function AdminCreditRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [reviewModal, setReviewModal] = useState(null)
  const [note, setNote] = useState('')
  const [reviewing, setReviewing] = useState(false)

  const fetchRequests = () => {
    setLoading(true)
    adminAPI.creditRequests(filter || undefined)
      .then(r => setRequests(r.data || []))
      .catch(() => toast.error('Erreur chargement demandes'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchRequests() }, [filter])

  const handleReview = async (status) => {
    if (!reviewModal) return
    setReviewing(true)
    try {
      await adminAPI.reviewCreditRequest(reviewModal.id, { status, admin_note: note || null })
      toast.success(status === 'APPROVED' ? 'Demande approuvee' : 'Demande refusee')
      setReviewModal(null)
      setNote('')
      fetchRequests()
    } catch {
      toast.error('Erreur lors du traitement')
    } finally {
      setReviewing(false)
    }
  }

  const pending = requests.filter(r => r.status === 'PENDING')
  const totalRequested = requests.reduce((s, r) => s + r.amount, 0)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Demandes de Credit</h1>
          <p className="text-sm text-gray-500 mt-1">{pending.length} demandes en attente</p>
        </div>
        <div className="flex gap-2">
          {['', 'PENDING', 'APPROVED', 'REJECTED'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filter === f ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === '' ? 'Toutes' : STATUS_MAP[f]?.label || f}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-2xl font-black text-gray-900">{requests.length}</p>
          <p className="text-xs text-gray-500">Total demandes</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-2xl font-black text-yellow-600">{pending.length}</p>
          <p className="text-xs text-gray-500">En attente</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-2xl font-black text-green-600">{requests.filter(r => r.status === 'APPROVED').length}</p>
          <p className="text-xs text-gray-500">Approuvees</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-2xl font-black text-purple-600">{totalRequested.toFixed(0)}</p>
          <p className="text-xs text-gray-500">Total demande (MAD)</p>
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
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Duree</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Frais</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Statut</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {requests.map(r => {
                const st = STATUS_MAP[r.status] || { label: r.status, color: 'bg-gray-100 text-gray-600' }
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.business_name}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{r.amount.toFixed(0)} MAD</td>
                    <td className="px-4 py-3 text-right text-gray-600">{r.term_days}j</td>
                    <td className="px-4 py-3 text-right text-gray-600">{r.fee_percentage}%</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${st.color}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(r.created_at).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.status === 'PENDING' ? (
                        <button
                          onClick={() => { setReviewModal(r); setNote('') }}
                          className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700"
                        >
                          Traiter
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">
                          {r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString('fr-FR') : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {requests.length === 0 && (
          <div className="text-center py-8 text-gray-400">Aucune demande trouvee</div>
        )}
      </div>

      {/* Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setReviewModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Traiter la demande</h3>

            <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Marchand</span>
                <span className="font-semibold text-gray-900">{reviewModal.business_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Montant</span>
                <span className="font-bold text-gray-900">{reviewModal.amount.toFixed(0)} MAD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Duree</span>
                <span className="text-gray-900">{reviewModal.term_days} jours</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Frais</span>
                <span className="text-gray-900">{reviewModal.fee_percentage}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Remboursement</span>
                <span className="font-bold text-gray-900">
                  {(reviewModal.amount * (1 + reviewModal.fee_percentage / 100)).toFixed(0)} MAD
                </span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Note (optionnelle)</label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Motif de la decision..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleReview('APPROVED')}
                disabled={reviewing}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 text-sm"
              >
                <FiCheck className="h-4 w-4" /> Approuver
              </button>
              <button
                onClick={() => handleReview('REJECTED')}
                disabled={reviewing}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 text-sm"
              >
                <FiX className="h-4 w-4" /> Refuser
              </button>
            </div>

            <button
              onClick={() => setReviewModal(null)}
              className="w-full mt-2 py-2 text-gray-500 text-sm hover:text-gray-700"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
