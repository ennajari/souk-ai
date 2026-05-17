import { useState, useEffect } from 'react'
import { FiCreditCard, FiDollarSign } from 'react-icons/fi'
import { supplierPortalAPI } from '../api/client'
import toast from 'react-hot-toast'

const METHOD_LABELS = {
  CASH: 'Especes', NFC_SOUKCARD: 'Carte Souk.AI', NFC_BANK: 'Carte bancaire NFC',
  CMI: 'Carte bancaire', BANK_TRANSFER: 'Virement',
}
const STATUS_LABELS = {
  PENDING: 'En attente', PROCESSING: 'En cours', COMPLETED: 'Recu', PAID: 'Recu',
  FAILED: 'Echoue', CANCELLED: 'Annule',
}
const statusColor = {
  PENDING: 'bg-yellow-100 text-yellow-700', PROCESSING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700', PAID: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700', CANCELLED: 'bg-gray-100 text-gray-500',
}

export default function SupplierPayments() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supplierPortalAPI.payments()
      .then(r => setPayments(r.data || []))
      .catch(() => toast.error('Erreur chargement paiements'))
      .finally(() => setLoading(false))
  }, [])

  const totalReceived = payments
    .filter(p => p.status === 'COMPLETED' || p.status === 'PAID')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Paiements recus</h1>
        <p className="text-gray-500 text-sm mt-1">Historique des paiements de vos marchands</p>
      </div>

      {/* Summary */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <FiDollarSign className="h-6 w-6" />
          <p className="text-sm font-medium opacity-80">Total recus</p>
        </div>
        <p className="text-3xl font-black">{totalReceived.toFixed(2)} MAD</p>
        <p className="text-sm opacity-70 mt-1">{payments.filter(p => p.status === 'COMPLETED' || p.status === 'PAID').length} paiements confirmes</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-16">
          <FiCreditCard className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">Aucun paiement recu</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase">Date</th>
                  <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase">Marchand</th>
                  <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase">Montant</th>
                  <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase">Methode</th>
                  <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase">Statut</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-5 py-3 text-gray-600">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                    </td>
                    <td className="px-5 py-3 font-semibold text-gray-800">{p.merchant_name || 'Marchand'}</td>
                    <td className="px-5 py-3 font-bold text-green-600">+{Number(p.amount || 0).toFixed(2)} MAD</td>
                    <td className="px-5 py-3 text-gray-600">{METHOD_LABELS[p.method] || p.method}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor[p.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-50">
            {payments.map((p) => (
              <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{p.merchant_name || 'Marchand'}</p>
                  <p className="text-xs text-gray-400">
                    {METHOD_LABELS[p.method] || p.method} · {p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-600">+{Number(p.amount || 0).toFixed(2)}</p>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor[p.status] || 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABELS[p.status] || p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
