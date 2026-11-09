import { useState, useEffect } from 'react'
import { FiPlus, FiEdit2, FiTrash2, FiX, FiPackage } from 'react-icons/fi'
import { supplierPortalAPI } from '../api/client'
import toast from 'react-hot-toast'

const UNITS = ['piece', 'kg', 'litre', 'carton', 'pack']

export default function SupplierCatalog() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ name: '', unit: 'piece', unit_price: '', barcode: '', category: '' })
  const [saving, setSaving] = useState(false)

  const fetchCatalog = () => {
    setLoading(true)
    supplierPortalAPI.catalog()
      .then(r => setItems(r.data || []))
      .catch(() => toast.error('Erreur chargement catalogue'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchCatalog() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const data = { ...form, unit_price: parseFloat(form.unit_price) || 0 }
      if (editId) {
        await supplierPortalAPI.updateCatalogItem(editId, data)
        toast.success('Article mis a jour')
      } else {
        await supplierPortalAPI.addCatalogItem(data)
        toast.success('Article ajoute')
      }
      closeForm()
      fetchCatalog()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (itemId) => {
    try {
      await supplierPortalAPI.deleteCatalogItem(itemId)
      toast.success('Article retire')
      setItems(prev => prev.filter(i => i.id !== itemId))
    } catch {
      toast.error('Erreur')
    }
  }

  const openEdit = (item) => {
    setEditId(item.id)
    setForm({
      name: item.name,
      unit: item.unit,
      unit_price: item.unit_price,
      barcode: item.barcode || '',
      category: item.category || '',
    })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditId(null)
    setForm({ name: '', unit: 'piece', unit_price: '', barcode: '', category: '' })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Mon catalogue</h1>
          <p className="text-gray-500 text-sm mt-1">
            Gerez vos produits — les marchands pourront consulter votre catalogue
          </p>
        </div>
        <button
          onClick={() => { closeForm(); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 text-sm font-semibold shadow-lg shadow-brand-200 transition-all"
        >
          <FiPlus className="h-4 w-4" /> Ajouter
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-brand-50 border border-brand-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-brand-800">{editId ? 'Modifier l\'article' : 'Nouvel article'}</h3>
            <button type="button" onClick={closeForm} className="p-1.5 hover:bg-brand-100 rounded-lg">
              <FiX className="h-4 w-4 text-brand-600" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nom du produit *"
              className="sm:col-span-2 border border-brand-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400 bg-white"
            />
            <input
              type="number"
              step="0.01"
              value={form.unit_price}
              onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
              placeholder="Prix unitaire (MAD)"
              className="border border-brand-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400 bg-white"
            />
            <input
              value={form.barcode}
              onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
              placeholder="Code-barres (optionnel)"
              className="border border-brand-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400 bg-white"
            />
            <select
              value={form.unit}
              onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
              className="border border-brand-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400 bg-white"
            >
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <input
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              placeholder="Categorie (optionnel)"
              className="border border-brand-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400 bg-white"
            />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={closeForm}
              className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="px-5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700 disabled:opacity-50">
              {saving ? 'Enregistrement...' : editId ? 'Modifier' : 'Ajouter'}
            </button>
          </div>
        </form>
      )}

      {/* Items */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <FiPackage className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Aucun article dans votre catalogue</p>
          <p className="text-sm text-gray-500 mt-1">Ajoutez des produits pour que les marchands puissent les voir</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase">Produit</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase">Unite</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase">Prix</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Code-barres</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Categorie</th>
                  <th className="px-5 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{item.name}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{item.unit}</td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-gray-900">{Number(item.unit_price).toFixed(2)} MAD</td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 font-mono hidden sm:table-cell">{item.barcode || '—'}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 hidden sm:table-cell">{item.category || '—'}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openEdit(item)} className="p-2 hover:bg-brand-50 rounded-lg transition-colors">
                          <FiEdit2 className="h-3.5 w-3.5 text-brand-600" />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-red-50 rounded-lg transition-colors">
                          <FiTrash2 className="h-3.5 w-3.5 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
