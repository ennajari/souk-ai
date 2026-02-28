import { useState, useEffect } from 'react'
import client from '../api/client'

const CATEGORIES = ['FMCG', 'FRESH', 'BEVERAGES', 'DAIRY', 'SNACKS', 'OTHER']

const emptyForm = { name: '', category: 'FMCG', contact_name: '', phone_number: '', email: '', minimum_order_value: 0 }

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const fetchSuppliers = () => {
    setLoading(true)
    client.get('/suppliers/')
      .then(r => setSuppliers(r.data))
      .catch(() => setError('Erreur lors du chargement'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchSuppliers() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await client.post('/suppliers/', form)
      setShowForm(false)
      setForm(emptyForm)
      fetchSuppliers()
    } catch {
      setError('Erreur lors de la création du fournisseur')
    } finally {
      setSaving(false)
    }
  }

  const categoryColor = {
    FMCG: 'bg-blue-100 text-blue-700',
    FRESH: 'bg-green-100 text-green-700',
    BEVERAGES: 'bg-cyan-100 text-cyan-700',
    DAIRY: 'bg-yellow-100 text-yellow-700',
    SNACKS: 'bg-orange-100 text-orange-700',
    OTHER: 'bg-gray-100 text-gray-700',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fournisseurs</h1>
          <p className="text-sm text-gray-500 mt-1">Gérez vos fournisseurs et passez des commandes groupées</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
        >
          + Ajouter
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Add supplier form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Nouveau fournisseur</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
              <input
                required
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Ex: Marjane Grossiste"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom du contact</label>
              <input
                value={form.contact_name}
                onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Ahmed Benali"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <input
                value={form.phone_number}
                onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="+212..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Commande min. (MAD)</label>
              <input
                type="number"
                value={form.minimum_order_value}
                onChange={e => setForm(f => ({ ...f, minimum_order_value: parseFloat(e.target.value) || 0 }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm(emptyForm) }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Suppliers list */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
        </div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg font-medium">Aucun fournisseur</p>
          <p className="text-sm mt-1">Ajoutez votre premier fournisseur pour commencer.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map(s => (
            <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{s.name}</h3>
                  {s.contact_name && <p className="text-xs text-gray-500 mt-0.5">{s.contact_name}</p>}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${categoryColor[s.category] || 'bg-gray-100 text-gray-600'}`}>
                  {s.category}
                </span>
              </div>
              <div className="space-y-1.5 text-sm">
                {s.phone_number && (
                  <p className="text-gray-600 flex items-center gap-2">
                    <span>📞</span> {s.phone_number}
                  </p>
                )}
                {s.email && (
                  <p className="text-gray-600 flex items-center gap-2">
                    <span>✉️</span> {s.email}
                  </p>
                )}
                <p className="text-gray-600 flex items-center gap-2">
                  <span>💰</span> Commande min: {s.minimum_order_value} MAD
                </p>
              </div>
              <div className={`mt-3 text-xs font-medium ${s.is_active ? 'text-green-600' : 'text-red-500'}`}>
                ● {s.is_active ? 'Actif' : 'Inactif'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
