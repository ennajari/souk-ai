import { useState, useEffect, useMemo } from 'react'
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiAlertCircle } from 'react-icons/fi'
import { productsAPI } from '../api/client'
import toast from 'react-hot-toast'

export default function Products() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ name_ar: '', name_fr: '', barcode: '', unit: 'piece', unit_price: 0, cost_price: 0 })

  const loadProducts = () => {
    productsAPI.list()
      .then((res) => setProducts(res.data))
      .catch(() => toast.error('Erreur chargement produits'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadProducts() }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return products
    const q = search.toLowerCase()
    return products.filter(p =>
      p.name_ar?.toLowerCase().includes(q) ||
      p.name_fr?.toLowerCase().includes(q) ||
      p.barcode?.includes(q)
    )
  }, [products, search])

  const noPriceCount = products.filter(p => !p.unit_price || p.unit_price === 0).length

  const handleChange = (e) => {
    const val = e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value
    setForm({ ...form, [e.target.name]: val })
  }

  const openAdd = () => {
    setEditId(null)
    setForm({ name_ar: '', name_fr: '', barcode: '', unit: 'piece', unit_price: 0, cost_price: 0 })
    setShowModal(true)
  }

  const openEdit = (p) => {
    setEditId(p.id)
    setForm({ name_ar: p.name_ar, name_fr: p.name_fr, barcode: p.barcode || '', unit: p.unit, unit_price: p.unit_price, cost_price: p.cost_price })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editId) {
        await productsAPI.update(editId, form)
        toast.success('Produit mis à jour')
      } else {
        await productsAPI.create(form)
        toast.success('Produit ajouté')
      }
      setShowModal(false)
      loadProducts()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce produit?')) return
    try {
      await productsAPI.delete(id)
      toast.success('Produit supprimé')
      loadProducts()
    } catch {
      toast.error('Erreur suppression')
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" /></div>
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produits</h1>
          <p className="text-sm text-gray-500 mt-0.5">{products.length} produit(s) au total</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors text-sm font-medium shadow-sm">
          <FiPlus className="h-4 w-4" /> Ajouter
        </button>
      </div>

      {/* Price warning banner */}
      {noPriceCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <FiAlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">
              {noPriceCount} produit(s) sans prix défini
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Cliquez sur ✏️ pour définir le prix, ou envoyez le prix via WhatsApp: <span className="font-mono bg-amber-100 px-1 rounded">ex: "sardines 10 DH"</span>
            </p>
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un produit..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unité</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prix vente</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((p) => {
                const hasNoPrice = !p.unit_price || p.unit_price === 0
                const isLowStock = p.stock_quantity !== null && p.stock_quantity <= 10
                return (
                  <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${hasNoPrice ? 'bg-amber-50/30' : ''}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-sm font-bold text-purple-600 flex-shrink-0">
                          {(p.name_ar || p.name_fr || '?')[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{p.name_ar}</p>
                          {p.name_fr !== p.name_ar && <p className="text-xs text-gray-400">{p.name_fr}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{p.unit}</td>
                    <td className="px-5 py-3.5">
                      {hasNoPrice ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium">
                          <FiAlertCircle className="h-3 w-3" /> Prix manquant
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-gray-800">{Number(p.unit_price).toFixed(2)} MAD</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        p.stock_quantity === null ? 'bg-gray-100 text-gray-500' :
                        isLowStock ? 'bg-red-100 text-red-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {p.stock_quantity !== null ? p.stock_quantity : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(p)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                          <FiEdit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-400">
                    {search ? `Aucun résultat pour "${search}"` : 'Aucun produit. Ajoutez votre premier produit!'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold mb-5 text-gray-900">{editId ? 'Modifier' : 'Ajouter'} un produit</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Nom arabe *</label>
                  <input name="name_ar" value={form.name_ar} onChange={handleChange} placeholder="طماطم" required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Nom français *</label>
                  <input name="name_fr" value={form.name_fr} onChange={handleChange} placeholder="Tomates" required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Unité</label>
                  <select name="unit" value={form.unit} onChange={handleChange}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm">
                    <option value="piece">Pièce</option>
                    <option value="kg">Kilogramme</option>
                    <option value="litre">Litre</option>
                    <option value="carton">Carton</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Code-barres</label>
                  <input name="barcode" value={form.barcode} onChange={handleChange} placeholder="Optionnel"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Prix vente (MAD)</label>
                  <input name="unit_price" type="number" step="0.01" min="0" value={form.unit_price} onChange={handleChange}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Prix achat (MAD)</label>
                  <input name="cost_price" type="number" step="0.01" min="0" value={form.cost_price} onChange={handleChange}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-medium text-gray-700">
                  Annuler
                </button>
                <button type="submit"
                  className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 text-sm font-medium">
                  {editId ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
