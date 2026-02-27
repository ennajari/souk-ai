import { useState, useEffect } from 'react'
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi'
import { productsAPI } from '../api/client'
import toast from 'react-hot-toast'

export default function Products() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ name_ar: '', name_fr: '', barcode: '', unit: 'piece', unit_price: 0, cost_price: 0 })

  const loadProducts = () => {
    productsAPI.list()
      .then((res) => setProducts(res.data))
      .catch(() => toast.error('Erreur chargement produits'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadProducts() }, [])

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
        toast.success('Produit mis a jour')
      } else {
        await productsAPI.create(form)
        toast.success('Produit ajoute')
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
      toast.success('Produit supprime')
      loadProducts()
    } catch {
      toast.error('Erreur suppression')
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Produits</h1>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
          <FiPlus /> Ajouter
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom (AR)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom (FR)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unite</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prix vente</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{p.name_ar}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{p.name_fr}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{p.unit}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{p.unit_price.toFixed(2)} MAD</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    p.stock_quantity === null ? 'bg-gray-100 text-gray-500' :
                    p.stock_quantity <= 10 ? 'bg-red-100 text-red-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {p.stock_quantity !== null ? p.stock_quantity : '-'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button onClick={() => openEdit(p)} className="text-blue-600 hover:text-blue-800"><FiEdit2 /></button>
                  <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:text-red-700"><FiTrash2 /></button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan="6" className="px-6 py-8 text-center text-gray-400">Aucun produit. Ajoutez votre premier produit!</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">{editId ? 'Modifier' : 'Ajouter'} un produit</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input name="name_ar" value={form.name_ar} onChange={handleChange} placeholder="Nom en arabe" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
              <input name="name_fr" value={form.name_fr} onChange={handleChange} placeholder="Nom en francais" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
              <input name="barcode" value={form.barcode} onChange={handleChange} placeholder="Code-barres (optionnel)" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
              <select name="unit" value={form.unit} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none">
                <option value="piece">Piece</option>
                <option value="kg">Kilogramme</option>
                <option value="litre">Litre</option>
                <option value="carton">Carton</option>
              </select>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Prix vente (MAD)</label>
                  <input name="unit_price" type="number" step="0.01" value={form.unit_price} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Prix achat (MAD)</label>
                  <input name="cost_price" type="number" step="0.01" value={form.cost_price} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
                <button type="submit" className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">{editId ? 'Modifier' : 'Ajouter'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
