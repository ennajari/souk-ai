import { useState, useEffect } from 'react'
import { FiShoppingBag, FiPlus, FiSearch, FiMapPin, FiPackage, FiTruck, FiX, FiEdit2, FiTrash2, FiEye } from 'react-icons/fi'
import client from '../api/client'
import toast from 'react-hot-toast'

const CATEGORIES = ['GROCERY', 'BAKERY', 'BUTCHER', 'PHARMACY', 'RESTAURANT', 'MARKET', 'OTHER']
const ORDER_STATUSES = { PENDING: 'En attente', ACCEPTED: 'Acceptee', SHIPPED: 'Expediee', DELIVERED: 'Livree', CANCELLED: 'Annulee', DISPUTED: 'Litige' }
const statusColor = {
  PENDING: 'bg-yellow-100 text-yellow-700', ACCEPTED: 'bg-blue-100 text-blue-700',
  SHIPPED: 'bg-indigo-100 text-indigo-700', DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700', DISPUTED: 'bg-orange-100 text-orange-700',
}

const emptyListing = { title: '', description: '', category: 'GROCERY', unit_price: '', min_quantity: 1, available_quantity: '', unit: 'piece', city: '' }

export default function Marketplace() {
  const [tab, setTab] = useState('browse') // browse, my-listings, orders
  const [listings, setListings] = useState([])
  const [myListings, setMyListings] = useState([])
  const [buyingOrders, setBuyingOrders] = useState([])
  const [sellingOrders, setSellingOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyListing)
  const [orderForm, setOrderForm] = useState({ listing_id: '', quantity: 1, delivery_address: '', notes: '' })
  const [selectedListing, setSelectedListing] = useState(null)
  const [saving, setSaving] = useState(false)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [browse, mine, buying, selling] = await Promise.all([
        client.get('/marketplace/listings', { params: { search, category: category || undefined } }),
        client.get('/marketplace/my-listings'),
        client.get('/marketplace/orders/buying'),
        client.get('/marketplace/orders/selling'),
      ])
      setListings(browse.data.items || browse.data)
      setMyListings(mine.data)
      setBuyingOrders(buying.data)
      setSellingOrders(selling.data)
    } catch { toast.error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [search, category])

  const handleCreateListing = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, unit_price: parseFloat(form.unit_price), available_quantity: parseInt(form.available_quantity), min_quantity: parseInt(form.min_quantity) }
      if (editingId) {
        await client.patch(`/marketplace/listings/${editingId}`, payload)
        toast.success('Annonce mise a jour')
      } else {
        await client.post('/marketplace/listings', payload)
        toast.success('Annonce publiee!')
      }
      setShowModal(false); setForm(emptyListing); setEditingId(null); fetchAll()
    } catch (err) { toast.error(err.response?.data?.detail || 'Erreur') }
    finally { setSaving(false) }
  }

  const handleOrder = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await client.post('/marketplace/orders', orderForm)
      toast.success('Commande passee!')
      setShowOrderModal(false); setSelectedListing(null); fetchAll()
    } catch (err) { toast.error(err.response?.data?.detail || 'Erreur') }
    finally { setSaving(false) }
  }

  const updateOrderStatus = async (orderId, status) => {
    try {
      await client.patch(`/marketplace/orders/${orderId}/status`, { status })
      toast.success('Statut mis a jour'); fetchAll()
    } catch (err) { toast.error(err.response?.data?.detail || 'Erreur') }
  }

  const deleteListing = async (id) => {
    try { await client.delete(`/marketplace/listings/${id}`); toast.success('Supprimee'); fetchAll() }
    catch { toast.error('Erreur') }
  }

  const openBuy = (listing) => {
    setSelectedListing(listing)
    setOrderForm({ listing_id: listing.id, quantity: listing.min_quantity, delivery_address: '', notes: '' })
    setShowOrderModal(true)
  }

  const openEdit = (listing) => {
    setEditingId(listing.id)
    setForm({ title: listing.title, description: listing.description || '', category: listing.category, unit_price: listing.unit_price, min_quantity: listing.min_quantity, available_quantity: listing.available_quantity, unit: listing.unit, city: listing.city || '' })
    setShowModal(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketplace B2B</h1>
          <p className="text-gray-500 text-sm">Achetez et vendez entre commercants</p>
        </div>
        <button onClick={() => { setShowModal(true); setEditingId(null); setForm(emptyListing) }} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          <FiPlus /> Publier une annonce
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {[['browse', 'Explorer', FiSearch], ['my-listings', 'Mes annonces', FiPackage], ['orders', 'Commandes', FiTruck]].map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === key ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {/* Browse Tab */}
      {tab === 'browse' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
            </div>
            <select value={category} onChange={e => setCategory(e.target.value)} className="px-4 py-2 border rounded-lg">
              <option value="">Toutes categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {loading ? <div className="text-center py-12 text-gray-400">Chargement...</div> : listings.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FiShoppingBag size={48} className="mx-auto mb-3 opacity-30" />
              <p>Aucune annonce disponible</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map(l => (
                <div key={l.id} className="bg-white rounded-xl border p-5 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">{l.category}</span>
                    <span className="text-xs text-gray-400 flex items-center gap-1"><FiEye size={12} /> {l.views_count}</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{l.title}</h3>
                  {l.description && <p className="text-sm text-gray-500 mb-3 line-clamp-2">{l.description}</p>}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xl font-bold text-purple-600">{l.unit_price} MAD<span className="text-sm font-normal text-gray-400">/{l.unit}</span></span>
                    <span className="text-sm text-gray-500">{l.available_quantity} dispo</span>
                  </div>
                  {l.city && <p className="text-sm text-gray-400 flex items-center gap-1 mb-3"><FiMapPin size={12} /> {l.city}</p>}
                  <div className="flex justify-between items-center pt-3 border-t">
                    <span className="text-sm text-gray-500">{l.seller_name}</span>
                    <button onClick={() => openBuy(l)} className="px-4 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700">Commander</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* My Listings Tab */}
      {tab === 'my-listings' && (
        <div className="space-y-4">
          {myListings.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FiPackage size={48} className="mx-auto mb-3 opacity-30" />
              <p>Vous n'avez aucune annonce</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 text-gray-600 text-sm">
                  <tr>
                    <th className="text-left px-4 py-3">Titre</th>
                    <th className="text-left px-4 py-3">Prix</th>
                    <th className="text-left px-4 py-3">Stock</th>
                    <th className="text-left px-4 py-3">Statut</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {myListings.map(l => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{l.title}</td>
                      <td className="px-4 py-3">{l.unit_price} MAD/{l.unit}</td>
                      <td className="px-4 py-3">{l.available_quantity}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${l.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{l.status}</span></td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openEdit(l)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><FiEdit2 size={16} /></button>
                        <button onClick={() => deleteListing(l.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded ml-1"><FiTrash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Orders Tab */}
      {tab === 'orders' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-3">Mes achats</h2>
            {buyingOrders.length === 0 ? <p className="text-gray-400">Aucun achat</p> : (
              <div className="space-y-3">
                {buyingOrders.map(o => (
                  <div key={o.id} className="bg-white rounded-lg border p-4 flex flex-col sm:flex-row justify-between gap-3">
                    <div>
                      <p className="font-medium">{o.listing_title}</p>
                      <p className="text-sm text-gray-500">Vendeur: {o.seller_name} | Qte: {o.quantity} | {o.total_amount} MAD</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[o.status] || 'bg-gray-100 text-gray-600'}`}>{ORDER_STATUSES[o.status]}</span>
                      {o.status === 'SHIPPED' && <button onClick={() => updateOrderStatus(o.id, 'DELIVERED')} className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg">Confirmer reception</button>}
                      {o.status === 'PENDING' && <button onClick={() => updateOrderStatus(o.id, 'CANCELLED')} className="px-3 py-1 bg-red-100 text-red-600 text-xs rounded-lg">Annuler</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-3">Mes ventes</h2>
            {sellingOrders.length === 0 ? <p className="text-gray-400">Aucune vente</p> : (
              <div className="space-y-3">
                {sellingOrders.map(o => (
                  <div key={o.id} className="bg-white rounded-lg border p-4 flex flex-col sm:flex-row justify-between gap-3">
                    <div>
                      <p className="font-medium">{o.listing_title}</p>
                      <p className="text-sm text-gray-500">Acheteur: {o.buyer_name} | Qte: {o.quantity} | {o.total_amount} MAD</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[o.status] || 'bg-gray-100 text-gray-600'}`}>{ORDER_STATUSES[o.status]}</span>
                      {o.status === 'PENDING' && <button onClick={() => updateOrderStatus(o.id, 'ACCEPTED')} className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg">Accepter</button>}
                      {o.status === 'ACCEPTED' && <button onClick={() => updateOrderStatus(o.id, 'SHIPPED')} className="px-3 py-1 bg-indigo-600 text-white text-xs rounded-lg">Marquer expediee</button>}
                      {['PENDING', 'ACCEPTED'].includes(o.status) && <button onClick={() => updateOrderStatus(o.id, 'CANCELLED')} className="px-3 py-1 bg-red-100 text-red-600 text-xs rounded-lg">Annuler</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create/Edit Listing Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">{editingId ? 'Modifier l\'annonce' : 'Nouvelle annonce'}</h2>
              <button onClick={() => { setShowModal(false); setEditingId(null) }} className="p-1 hover:bg-gray-100 rounded"><FiX /></button>
            </div>
            <form onSubmit={handleCreateListing} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required className="w-full px-3 py-2 border rounded-lg" placeholder="Ex: Huile d'olive en gros" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categorie</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unite</label>
                  <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                    {['piece', 'kg', 'litre', 'carton', 'palette'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prix (MAD)</label>
                  <input type="number" step="0.01" value={form.unit_price} onChange={e => setForm({ ...form, unit_price: e.target.value })} required className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Qte min</label>
                  <input type="number" value={form.min_quantity} onChange={e => setForm({ ...form, min_quantity: e.target.value })} required className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                  <input type="number" value={form.available_quantity} onChange={e => setForm({ ...form, available_quantity: e.target.value })} required className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="w-full px-3 py-2 border rounded-lg" placeholder="Casablanca, Rabat..." />
              </div>
              <button type="submit" disabled={saving} className="w-full py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50">
                {saving ? 'En cours...' : editingId ? 'Mettre a jour' : 'Publier'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Order Modal */}
      {showOrderModal && selectedListing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Commander</h2>
              <button onClick={() => setShowOrderModal(false)} className="p-1 hover:bg-gray-100 rounded"><FiX /></button>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="font-medium">{selectedListing.title}</p>
              <p className="text-sm text-gray-500">{selectedListing.unit_price} MAD/{selectedListing.unit} | Min: {selectedListing.min_quantity} | Vendeur: {selectedListing.seller_name}</p>
            </div>
            <form onSubmit={handleOrder} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantite</label>
                <input type="number" min={selectedListing.min_quantity} max={selectedListing.available_quantity} value={orderForm.quantity} onChange={e => setOrderForm({ ...orderForm, quantity: parseInt(e.target.value) })} required className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adresse de livraison</label>
                <input value={orderForm.delivery_address} onChange={e => setOrderForm({ ...orderForm, delivery_address: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={orderForm.notes} onChange={e => setOrderForm({ ...orderForm, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-2xl font-bold text-purple-600">{((orderForm.quantity || 0) * selectedListing.unit_price).toFixed(2)} MAD</p>
              </div>
              <button type="submit" disabled={saving} className="w-full py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50">
                {saving ? 'En cours...' : 'Confirmer la commande'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
