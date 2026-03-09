import { useState, useEffect } from 'react'
import { FiEdit2, FiTrash2, FiX, FiPlus, FiPhone, FiMail, FiSearch } from 'react-icons/fi'
import client from '../api/client'
import toast from 'react-hot-toast'

const CATEGORIES = ['FMCG', 'FRESH', 'BEVERAGES', 'DAIRY', 'SNACKS', 'OTHER']

const emptyForm = { name: '', category: 'FMCG', contact_name: '', phone_number: '', email: '', minimum_order_value: 0 }

const categoryColor = {
  FMCG: 'bg-blue-100 text-blue-700',
  FRESH: 'bg-green-100 text-green-700',
  BEVERAGES: 'bg-cyan-100 text-cyan-700',
  DAIRY: 'bg-yellow-100 text-yellow-700',
  SNACKS: 'bg-orange-100 text-orange-700',
  OTHER: 'bg-gray-100 text-gray-700',
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const fetchSuppliers = () => {
    setLoading(true)
    client.get('/suppliers/')
      .then(r => setSuppliers(r.data))
      .catch(() => toast.error('Erreur lors du chargement'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchSuppliers() }, [])

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.contact_name || '').toLowerCase().includes(search.toLowerCase()) ||
    s.category.toLowerCase().includes(search.toLowerCase())
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.minimum_order_value < 0) return toast.error('La commande minimum ne peut pas etre negative')
    setSaving(true)
    try {
      if (editingId) {
        await client.patch(`/suppliers/${editingId}`, form)
        toast.success('Fournisseur mis a jour')
      } else {
        await client.post('/suppliers/', form)
        toast.success('Fournisseur ajoute')
      }
      closeModal()
      fetchSuppliers()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (s) => {
    setForm({
      name: s.name,
      category: s.category,
      contact_name: s.contact_name || '',
      phone_number: s.phone_number || '',
      email: s.email || '',
      minimum_order_value: s.minimum_order_value || 0,
    })
    setEditingId(s.id)
    setShowModal(true)
  }

  const openAdd = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  const handleDelete = async (s) => {
    try {
      await client.delete(`/suppliers/${s.id}`)
      toast.success('Fournisseur supprime')
      setDeleteConfirm(null)
      fetchSuppliers()
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fournisseurs</h1>
          <p className="text-sm text-gray-500 mt-1">Gerez vos fournisseurs et passez des commandes groupees</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 text-sm font-semibold shadow-lg shadow-purple-200 transition-all"
        >
          <FiPlus className="h-4 w-4" /> Ajouter
        </button>
      </div>

      {/* Search */}
      {suppliers.length > 0 && (
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un fournisseur..."
            className="w-full sm:w-80 pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
          />
        </div>
      )}

      {/* Suppliers list */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
        </div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
            <FiPlus className="h-7 w-7 text-gray-400" />
          </div>
          <p className="text-lg font-medium">Aucun fournisseur</p>
          <p className="text-sm mt-1">Ajoutez votre premier fournisseur pour commencer.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => (
            <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{s.name}</h3>
                  {s.contact_name && <p className="text-xs text-gray-500 mt-0.5">{s.contact_name}</p>}
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(s)}
                    className="p-2 hover:bg-purple-50 rounded-lg transition-colors"
                    title="Modifier"
                  >
                    <FiEdit2 className="h-3.5 w-3.5 text-purple-600" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(s)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    title="Supprimer"
                  >
                    <FiTrash2 className="h-3.5 w-3.5 text-red-500" />
                  </button>
                </div>
              </div>

              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${categoryColor[s.category] || 'bg-gray-100 text-gray-600'}`}>
                {s.category}
              </span>

              <div className="space-y-1.5 text-sm mt-3">
                {s.phone_number && (
                  <p className="text-gray-600 flex items-center gap-2">
                    <FiPhone className="h-3.5 w-3.5 text-gray-400" /> {s.phone_number}
                  </p>
                )}
                {s.email && (
                  <p className="text-gray-600 flex items-center gap-2">
                    <FiMail className="h-3.5 w-3.5 text-gray-400" /> {s.email}
                  </p>
                )}
                <p className="text-gray-600 font-medium">Min: {s.minimum_order_value} MAD</p>
              </div>
              <div className={`mt-3 text-xs font-medium flex items-center gap-1.5 ${s.is_active ? 'text-green-600' : 'text-red-500'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                {s.is_active ? 'Actif' : 'Inactif'}
              </div>
            </div>
          ))}
          {filtered.length === 0 && search && (
            <div className="col-span-full text-center py-8 text-gray-400 text-sm">
              Aucun resultat pour "{search}"
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg font-bold text-gray-900">
                {editingId ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <FiX className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom *</label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  placeholder="Ex: Marjane Grossiste"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Categorie</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom du contact</label>
                  <input
                    value={form.contact_name}
                    onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Ahmed Benali"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Telephone</label>
                  <input
                    value={form.phone_number}
                    onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="+212..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Commande min. (MAD)</label>
                <input
                  type="number"
                  value={form.minimum_order_value}
                  onChange={e => setForm(f => ({ ...f, minimum_order_value: Math.max(0, parseFloat(e.target.value) || 0) }))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                  min="0"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Enregistrement...' : editingId ? 'Mettre a jour' : 'Enregistrer'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-medium transition-colors"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <FiTrash2 className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Supprimer le fournisseur ?</h3>
              <p className="text-sm text-gray-500 mt-2">
                Etes-vous sur de vouloir supprimer <strong>{deleteConfirm.name}</strong> ? Cette action est irreversible.
              </p>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-medium transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 text-sm font-semibold transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
