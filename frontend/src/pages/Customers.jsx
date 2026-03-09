import { useState, useEffect } from 'react'
import { FiPlus, FiSearch, FiPhone, FiChevronRight, FiX, FiArrowUp, FiArrowDown, FiTrash2, FiEdit2 } from 'react-icons/fi'
import client from '../api/client'
import toast from 'react-hot-toast'

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [entryForm, setEntryForm] = useState({ type: 'CREDIT', amount: '', description: '' })
  const [addingEntry, setAddingEntry] = useState(false)

  const fetchCustomers = () => {
    setLoading(true)
    client.get('/customers/')
      .then(r => setCustomers(r.data))
      .catch(() => toast.error('Erreur chargement clients'))
      .finally(() => setLoading(false))
  }

  const fetchDetail = (id) => {
    client.get(`/customers/${id}`)
      .then(r => { setDetail(r.data); setSelected(id) })
      .catch(() => toast.error('Erreur chargement detail'))
  }

  useEffect(() => { fetchCustomers() }, [])

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  )

  const totalOwed = customers.reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0)

  const handleAddCustomer = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await client.post('/customers/', form)
      toast.success('Client ajoute')
      setShowAdd(false)
      setForm({ name: '', phone: '', notes: '' })
      fetchCustomers()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const handleAddEntry = async (e) => {
    e.preventDefault()
    if (!entryForm.amount || parseFloat(entryForm.amount) <= 0) return toast.error('Montant invalide')
    setAddingEntry(true)
    try {
      await client.post(`/customers/${selected}/entries`, {
        type: entryForm.type,
        amount: parseFloat(entryForm.amount),
        description: entryForm.description || null,
      })
      toast.success(entryForm.type === 'CREDIT' ? 'Credit ajoute' : 'Paiement enregistre')
      setEntryForm({ type: 'CREDIT', amount: '', description: '' })
      fetchDetail(selected)
      fetchCustomers()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur')
    } finally {
      setAddingEntry(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await client.delete(`/customers/${id}`)
      toast.success('Client supprime')
      if (selected === id) { setSelected(null); setDetail(null) }
      fetchCustomers()
    } catch { toast.error('Erreur suppression') }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-7rem)]">
      {/* Left: Customer list */}
      <div className="w-full lg:w-96 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Carnet de credit</h1>
            <p className="text-sm text-gray-500 mt-0.5">Total du: <span className="font-bold text-red-600">{totalOwed.toFixed(2)} MAD</span></p>
          </div>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700">
            <FiPlus className="h-4 w-4" /> Client
          </button>
        </div>

        <div className="relative mb-3">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un client..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">{search ? 'Aucun resultat' : 'Aucun client'}</p>
            </div>
          ) : filtered.map(c => (
            <button
              key={c.id}
              onClick={() => fetchDetail(c.id)}
              className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between group ${
                selected === c.id ? 'bg-violet-50 border border-violet-200' : 'bg-white border border-gray-100 hover:border-gray-200'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm text-gray-900 truncate">{c.name}</p>
                {c.phone && <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><FiPhone className="h-3 w-3" />{c.phone}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${c.balance > 0 ? 'text-red-600' : c.balance < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                  {c.balance > 0 ? `${c.balance.toFixed(2)}` : c.balance < 0 ? `+${Math.abs(c.balance).toFixed(2)}` : '0'} MAD
                </span>
                <FiChevronRight className="h-4 w-4 text-gray-300" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right: Customer detail */}
      <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden min-h-0">
        {!detail ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <FiSearch className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Selectionnez un client pour voir son carnet</p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">{detail.name}</h2>
                {detail.phone && <p className="text-sm text-gray-500">{detail.phone}</p>}
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Solde</p>
                <p className={`text-xl font-black ${detail.balance > 0 ? 'text-red-600' : detail.balance < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                  {detail.balance.toFixed(2)} MAD
                </p>
              </div>
            </div>

            {/* Add entry form */}
            <form onSubmit={handleAddEntry} className="px-6 py-4 border-b bg-violet-50/50">
              <div className="flex gap-2 items-end">
                <div className="flex bg-gray-100 rounded-xl p-0.5">
                  <button type="button"
                    onClick={() => setEntryForm(f => ({ ...f, type: 'CREDIT' }))}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${entryForm.type === 'CREDIT' ? 'bg-red-600 text-white' : 'text-gray-600'}`}
                  >
                    <FiArrowUp className="h-3 w-3 inline mr-1" />Credit
                  </button>
                  <button type="button"
                    onClick={() => setEntryForm(f => ({ ...f, type: 'PAYMENT' }))}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${entryForm.type === 'PAYMENT' ? 'bg-green-600 text-white' : 'text-gray-600'}`}
                  >
                    <FiArrowDown className="h-3 w-3 inline mr-1" />Paiement
                  </button>
                </div>
                <input
                  type="number" step="0.01" min="0.01" placeholder="Montant"
                  value={entryForm.amount} onChange={e => setEntryForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-28 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                  required
                />
                <input
                  placeholder="Description (optionnel)"
                  value={entryForm.description} onChange={e => setEntryForm(f => ({ ...f, description: e.target.value }))}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button type="submit" disabled={addingEntry}
                  className="px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
                  {addingEntry ? '...' : 'Ajouter'}
                </button>
              </div>
            </form>

            {/* Entries list */}
            <div className="flex-1 overflow-y-auto divide-y">
              {(detail.entries || []).length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">Aucune operation</div>
              ) : detail.entries.map(entry => (
                <div key={entry.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      entry.type === 'CREDIT' ? 'bg-red-100' : 'bg-green-100'
                    }`}>
                      {entry.type === 'CREDIT'
                        ? <FiArrowUp className="h-4 w-4 text-red-600" />
                        : <FiArrowDown className="h-4 w-4 text-green-600" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {entry.type === 'CREDIT' ? 'Credit' : 'Paiement'}
                      </p>
                      {entry.description && <p className="text-xs text-gray-500">{entry.description}</p>}
                      <p className="text-xs text-gray-400">{new Date(entry.created_at).toLocaleString('fr-FR')}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${entry.type === 'CREDIT' ? 'text-red-600' : 'text-green-600'}`}>
                    {entry.type === 'CREDIT' ? '+' : '-'}{entry.amount.toFixed(2)} MAD
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add customer modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Nouveau client</h3>
              <button onClick={() => setShowAdd(false)} className="p-2 hover:bg-gray-100 rounded-xl"><FiX className="h-5 w-5 text-gray-500" /></button>
            </div>
            <form onSubmit={handleAddCustomer} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="Ex: Ahmed Benali" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telephone</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="+212 6XX XXX XXX" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="Notes optionnelles..." rows={2} />
              </div>
              <button type="submit" disabled={saving}
                className="w-full py-2.5 bg-violet-600 text-white rounded-xl font-semibold text-sm hover:bg-violet-700 disabled:opacity-50">
                {saving ? 'Enregistrement...' : 'Ajouter le client'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
