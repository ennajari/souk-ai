import { useState, useEffect } from 'react'
import { FiBox, FiAlertTriangle, FiCheck } from 'react-icons/fi'
import { inventoryAPI } from '../api/client'
import toast from 'react-hot-toast'
import StatsCard from '../components/StatsCard'

export default function Inventory() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [adjustModal, setAdjustModal] = useState(null)
  const [adjustQty, setAdjustQty] = useState(0)

  const load = () => {
    inventoryAPI.list()
      .then((res) => setItems(res.data))
      .catch(() => toast.error('Erreur chargement inventaire'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleAdjust = async () => {
    try {
      await inventoryAPI.adjust({ product_id: adjustModal.product_id, quantity_change: adjustQty })
      toast.success('Stock ajuste')
      setAdjustModal(null)
      setAdjustQty(0)
      load()
    } catch {
      toast.error('Erreur ajustement')
    }
  }

  const inStock = items.filter((i) => i.quantity > i.reorder_threshold).length
  const lowStock = items.filter((i) => i.quantity > 0 && i.quantity <= i.reorder_threshold).length
  const outOfStock = items.filter((i) => i.quantity <= 0).length

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div></div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Inventaire</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard title="En stock" value={inStock} icon={FiCheck} color="green" />
        <StatsCard title="Stock bas" value={lowStock} icon={FiAlertTriangle} color="orange" />
        <StatsCard title="Rupture" value={outOfStock} icon={FiBox} color="red" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantite</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unite</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Seuil</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map((item) => {
              const isLow = item.quantity > 0 && item.quantity <= item.reorder_threshold
              const isOut = item.quantity <= 0
              return (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{item.product_name_ar}</div>
                    <div className="text-xs text-gray-500">{item.product_name_fr}</div>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">{item.quantity}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{item.unit || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{item.reorder_threshold}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      isOut ? 'bg-red-100 text-red-700' :
                      isLow ? 'bg-orange-100 text-orange-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {isOut ? 'Rupture' : isLow ? 'Stock bas' : 'OK'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => { setAdjustModal(item); setAdjustQty(0) }}
                      className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                    >
                      Ajuster
                    </button>
                  </td>
                </tr>
              )
            })}
            {items.length === 0 && (
              <tr><td colSpan="6" className="px-6 py-8 text-center text-gray-400">Aucun inventaire. Ajoutez des produits d'abord.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {adjustModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-bold mb-2">Ajuster le stock</h2>
            <p className="text-sm text-gray-500 mb-4">{adjustModal.product_name_ar} - Stock actuel: {adjustModal.quantity}</p>
            <input
              type="number"
              value={adjustQty}
              onChange={(e) => setAdjustQty(parseFloat(e.target.value) || 0)}
              placeholder="Ex: +10 ou -5"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setAdjustModal(null)} className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={handleAdjust} className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">Ajuster</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
