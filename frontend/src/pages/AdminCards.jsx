import { useState, useEffect } from 'react'
import { FiCreditCard, FiSearch } from 'react-icons/fi'
import { adminAPI } from '../api/client'
import SoukCardVisual from '../components/SoukCardVisual'
import toast from 'react-hot-toast'

export default function AdminCards() {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    adminAPI.cards()
      .then(r => setCards(r.data || []))
      .catch(() => toast.error('Erreur chargement cartes'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = cards.filter(c =>
    c.holder_name.toLowerCase().includes(search.toLowerCase()) ||
    c.card_number.includes(search) ||
    c.holder_phone.includes(search)
  )

  const totalBalance = cards.reduce((s, c) => s + c.balance, 0)
  const clientCards = cards.filter(c => c.card_type === 'CLIENT')
  const supplierCards = cards.filter(c => c.card_type === 'SUPPLIER')
  const activeCards = cards.filter(c => c.status === 'ACTIVE')

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cartes Souk.AI</h1>
          <p className="text-sm text-gray-500 mt-1">{cards.length} cartes emises</p>
        </div>
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Nom, numero, telephone..."
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500 w-72"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-2xl font-black text-gray-900">{cards.length}</p>
          <p className="text-xs text-gray-500">Total cartes</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-2xl font-black text-purple-600">{clientCards.length}</p>
          <p className="text-xs text-gray-500">Cartes Client</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-2xl font-black text-blue-600">{supplierCards.length}</p>
          <p className="text-xs text-gray-500">Cartes Fournisseur</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-2xl font-black text-green-600">{totalBalance.toFixed(2)}</p>
          <p className="text-xs text-gray-500">Solde total (MAD)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Numero</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Titulaire</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Solde</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Statut</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(c => (
                  <tr key={c.id}
                    onClick={() => setSelected(c)}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${selected?.id === c.id ? 'bg-red-50' : ''}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">
                      {c.card_number.replace(/(.{4})/g, '$1 ').trim()}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{c.holder_name}</p>
                      <p className="text-xs text-gray-400">{c.holder_phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        c.card_type === 'SUPPLIER' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {c.card_type === 'SUPPLIER' ? 'Fournisseur' : 'Client'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{c.balance.toFixed(2)} MAD</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        c.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                        c.status === 'SUSPENDED' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {c.status === 'ACTIVE' ? 'Active' : c.status === 'SUSPENDED' ? 'Suspendue' : 'Expiree'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(c.created_at).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-8 text-gray-400">Aucune carte trouvee</div>
          )}
        </div>

        {/* Card preview */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Apercu de la carte</h3>
            {selected ? (
              <SoukCardVisual
                cardNumber={selected.card_number}
                holderName={selected.holder_name}
                balance={selected.balance}
                cardType={selected.card_type || 'CLIENT'}
              />
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                <FiCreditCard className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Selectionnez une carte
              </div>
            )}
          </div>
          {selected && (
            <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Numero</span>
                  <span className="font-mono text-gray-900">{selected.card_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Telephone</span>
                  <span className="text-gray-900">{selected.holder_phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">NFC UID</span>
                  <span className="font-mono text-gray-900 text-xs">{selected.nfc_uid || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Creee le</span>
                  <span className="text-gray-900">{new Date(selected.created_at).toLocaleString('fr-FR')}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
