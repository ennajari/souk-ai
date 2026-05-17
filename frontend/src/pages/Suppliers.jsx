import { useState, useEffect, useRef } from 'react'
import { FiEdit2, FiTrash2, FiX, FiPlus, FiPhone, FiMail, FiSearch, FiShoppingCart, FiDollarSign, FiCreditCard, FiTruck, FiPackage, FiSmartphone, FiShield, FiCheckCircle } from 'react-icons/fi'
import client from '../api/client'
import { suppliersAPI } from '../api/client'
import toast from 'react-hot-toast'

const CATEGORIES = ['FMCG', 'FRESH', 'BEVERAGES', 'DAIRY', 'SNACKS', 'OTHER']

const emptyForm = { name: '', category: 'FMCG', contact_name: '', phone_number: '', email: '', minimum_order_value: 0 }

const ORDER_STATUS_LABELS = {
  PENDING: 'En attente', SUBMITTED: 'Soumise', IN_DELIVERY: 'En livraison',
  DELIVERED: 'Livree', CANCELLED: 'Annulee',
}
const orderStatusColor = {
  PENDING: 'bg-yellow-100 text-yellow-700', SUBMITTED: 'bg-blue-100 text-blue-700',
  IN_DELIVERY: 'bg-orange-100 text-orange-700', DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

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
  const [tab, setTab] = useState('suppliers')
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [payModal, setPayModal] = useState(null)
  const [payMethod, setPayMethod] = useState('CASH')
  const [paying, setPaying] = useState(false)
  const [orderModal, setOrderModal] = useState(false)
  const [orderSupplier, setOrderSupplier] = useState('')
  const [products, setProducts] = useState([])
  const [orderItems, setOrderItems] = useState([])
  const [productSearch, setProductSearch] = useState('')
  const [ordering, setOrdering] = useState(false)
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [deleteOrderConfirm, setDeleteOrderConfirm] = useState(null)
  const [deletingOrder, setDeletingOrder] = useState(false)
  // NFC SoukCard flow states
  const [payStep, setPayStep] = useState('select') // select | nfc_waiting | card_found | pin_entry | processing | success | error
  const [nfcReading, setNfcReading] = useState(false)
  const [detectedCard, setDetectedCard] = useState(null)
  const [cardPin, setCardPin] = useState('')
  const [payError, setPayError] = useState('')
  const nfcAbort = useRef(null)
  const pinRef = useRef(null)

  const fetchOrders = () => {
    setOrdersLoading(true)
    Promise.all(suppliers.map(s => suppliersAPI.orders(s.id).then(r => (r.data || []).map(o => ({ ...o, supplier_name: s.name, supplier_id: s.id }))).catch(() => [])))
      .then(results => setOrders(results.flat()))
      .finally(() => setOrdersLoading(false))
  }

  const hasNfc = typeof window !== 'undefined' && 'NDEFReader' in window

  const handlePay = async () => {
    if (!payModal) return
    if (payMethod === 'NFC_SOUKCARD') {
      startNfcScan()
      return
    }
    setPaying(true)
    try {
      await suppliersAPI.payOrder(payModal.supplier_id, payModal.id, payMethod)
      toast.success('Paiement effectue avec succes')
      closePayModal()
      fetchOrders()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur de paiement')
    } finally {
      setPaying(false)
    }
  }

  const closePayModal = () => {
    stopNfcScan()
    setPayModal(null)
    setPayStep('select')
    setDetectedCard(null)
    setCardPin('')
    setPayError('')
  }

  const startNfcScan = async () => {
    if (!hasNfc) {
      setPayError('NFC non disponible sur cet appareil. Utilisez un telephone Android avec NFC active.')
      return
    }
    try {
      setPayStep('nfc_waiting')
      setNfcReading(true)
      setPayError('')
      const ctrl = new AbortController()
      nfcAbort.current = ctrl
      const ndef = new NDEFReader()
      await ndef.scan({ signal: ctrl.signal })
      ndef.addEventListener('reading', async ({ serialNumber }) => {
        setNfcReading(false)
        try {
          const res = await client.get(`/souk-cards/nfc/${serialNumber}`)
          if (res.data) {
            setDetectedCard({ ...res.data, nfc_uid: serialNumber })
            setPayStep('card_found')
          }
        } catch {
          setPayError('Carte non reconnue. Verifiez que la carte est enregistree.')
          setPayStep('select')
        }
      })
    } catch (err) {
      setNfcReading(false)
      if (err.name !== 'AbortError') {
        setPayError('Erreur NFC: ' + (err.message || ''))
        setPayStep('select')
      }
    }
  }

  const stopNfcScan = () => {
    if (nfcAbort.current) { nfcAbort.current.abort(); nfcAbort.current = null }
    setNfcReading(false)
  }

  const confirmPinAndPay = async () => {
    if (!payModal || !detectedCard || cardPin.length < 4) return
    setPayStep('processing')
    setPayError('')
    try {
      await suppliersAPI.payOrder(payModal.supplier_id, payModal.id, 'NFC_SOUKCARD')
      setPayStep('success')
      toast.success('Paiement effectue avec succes')
      setTimeout(() => {
        closePayModal()
        fetchOrders()
      }, 1500)
    } catch (err) {
      setPayStep('error')
      setPayError(err.response?.data?.detail || 'Erreur de paiement')
    }
  }

  const handleDeleteOrder = async (order) => {
    setDeletingOrder(true)
    try {
      await suppliersAPI.deleteOrder(order.supplier_id, order.id)
      toast.success('Commande supprimee')
      setDeleteOrderConfirm(null)
      fetchOrders()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de la suppression')
    } finally {
      setDeletingOrder(false)
    }
  }

  const openOrderModal = () => {
    setOrderSupplier(suppliers[0]?.id || '')
    setOrderItems([])
    setProductSearch('')
    setShowCustomForm(false)
    setCustomName('')
    setCustomPrice('')
    setOrderModal(true)
    if (products.length === 0) {
      client.get('/products/').then(r => setProducts(r.data || [])).catch(() => {})
    }
  }

  const addCustomItem = () => {
    if (!customName.trim() || !customPrice) return toast.error('Nom et prix requis')
    const id = `custom_${Date.now()}`
    setOrderItems(prev => [...prev, {
      product_id: null,
      custom_id: id,
      name: customName.trim(),
      cost_price: parseFloat(customPrice) || 0,
      quantity: 1,
      isCustom: true,
    }])
    setCustomName('')
    setCustomPrice('')
    setShowCustomForm(false)
  }

  const addOrderItem = (product) => {
    if (orderItems.find(i => i.product_id === product.id)) return
    setOrderItems(prev => [...prev, {
      product_id: product.id,
      name: product.name_fr || product.name_ar || '—',
      cost_price: Number(product.cost_price || 0),
      quantity: 1,
    }])
    setProductSearch('')
  }

  const getItemKey = (item) => item.product_id || item.custom_id

  const updateItemQty = (key, qty) => {
    setOrderItems(prev => prev.map(i => getItemKey(i) === key ? { ...i, quantity: Math.max(1, qty) } : i))
  }

  const removeItem = (key) => {
    setOrderItems(prev => prev.filter(i => getItemKey(i) !== key))
  }

  const orderTotal = orderItems.reduce((sum, i) => sum + i.quantity * i.cost_price, 0)

  const filteredProducts = products.filter(p => {
    if (!productSearch.trim()) return false
    const q = productSearch.toLowerCase()
    return (p.name_fr || '').toLowerCase().includes(q) ||
      (p.name_ar || '').toLowerCase().includes(q) ||
      (p.barcode || '').includes(q)
  }).slice(0, 8)

  const handlePlaceOrder = async () => {
    if (!orderSupplier) return toast.error('Choisissez un fournisseur')
    if (orderItems.length === 0) return toast.error('Ajoutez au moins un produit')
    setOrdering(true)
    try {
      const items = orderItems.map(i => i.isCustom
        ? { product_name: i.name, unit_price: i.cost_price, quantity: i.quantity }
        : { product_id: i.product_id, quantity: i.quantity }
      )
      await suppliersAPI.placeOrder(orderSupplier, items)
      toast.success('Commande passee avec succes !')
      setOrderModal(false)
      if (tab === 'orders') fetchOrders()
      setTab('orders')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de la commande')
    } finally {
      setOrdering(false)
    }
  }

  const fetchSuppliers = () => {
    setLoading(true)
    client.get('/suppliers/')
      .then(r => setSuppliers(r.data))
      .catch(() => toast.error('Erreur lors du chargement'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchSuppliers() }, [])
  useEffect(() => { if (tab === 'orders' && suppliers.length > 0) fetchOrders() }, [tab, suppliers.length])

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
        {tab === 'suppliers' && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 text-sm font-semibold shadow-lg shadow-purple-200 transition-all"
          >
            <FiPlus className="h-4 w-4" /> Ajouter
          </button>
        )}
      </div>

      {/* Tabs + New Order button */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {[
            { key: 'suppliers', label: 'Fournisseurs', icon: FiTruck },
            { key: 'orders', label: 'Commandes', icon: FiShoppingCart },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
        {suppliers.length > 0 && (
          <button
            onClick={openOrderModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 text-sm font-semibold shadow-lg shadow-orange-200 transition-all"
          >
            <FiShoppingCart className="h-4 w-4" /> Nouvelle commande
          </button>
        )}
      </div>

      {/* ── Orders Tab ── */}
      {tab === 'orders' && (
        ordersLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <FiShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-lg font-medium">Aucune commande</p>
            <p className="text-sm mt-1">Les commandes passees a vos fournisseurs apparaitront ici.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(o => (
              <div key={o.id} className="bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-gray-900">{o.supplier_name}</p>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${orderStatusColor[o.status] || 'bg-gray-100 text-gray-600'}`}>
                        {ORDER_STATUS_LABELS[o.status] || o.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {o.items?.length > 0
                        ? o.items.map((it, idx) => (
                            <span key={idx}>{it.product_name} x{it.quantity}{idx < o.items.length - 1 ? ', ' : ''}</span>
                          ))
                        : `${o.product_name || '—'} x${o.quantity || 0}`
                      }
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {o.created_at ? new Date(o.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-lg font-black text-gray-900">{Number(o.total_amount || o.total_cost || 0).toFixed(2)}</p>
                      <p className="text-[10px] text-gray-400">MAD</p>
                    </div>
                    {o.status === 'DELIVERED' && !o.payment_id && (
                      <button
                        onClick={() => { setPayModal(o); setPayMethod('CASH'); setPayStep('select'); setPayError('') }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-xl transition"
                      >
                        <FiDollarSign className="h-3.5 w-3.5" />
                        Payer
                      </button>
                    )}
                    {o.payment_id && (
                      <span className="px-2.5 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">Paye</span>
                    )}
                    {!o.payment_id && (
                      <button
                        onClick={() => setDeleteOrderConfirm(o)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="Supprimer la commande"
                      >
                        <FiTrash2 className="h-3.5 w-3.5 text-red-400 hover:text-red-600" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Suppliers Tab ── */}
      {tab === 'suppliers' && (
        <>
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

      </>
      )}

      {/* Pay Modal — with NFC SoukCard flow */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={closePayModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

            {/* ── Step: Select payment method ── */}
            {payStep === 'select' && (
              <div className="p-6">
                <div className="text-center mb-5">
                  <div className="w-12 h-12 mx-auto mb-3 bg-green-100 rounded-full flex items-center justify-center">
                    <FiDollarSign className="h-6 w-6 text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Payer la commande</h3>
                  <p className="text-sm text-gray-500 mt-1">{payModal.supplier_name}</p>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 mb-5">
                  {payModal.items?.length > 0 ? (
                    <div className="space-y-1 mb-2">
                      {payModal.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-gray-600">{it.product_name} x{it.quantity}</span>
                          <span className="font-medium text-gray-800">{(it.quantity * (it.unit_price || 0)).toFixed(2)} MAD</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">Commande</span>
                      <span className="font-medium text-gray-800">{payModal.supplier_name}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm pt-2 border-t border-gray-200 mt-2">
                    <span className="font-semibold text-gray-700">Total</span>
                    <span className="font-black text-gray-900">{Number(payModal.total_amount || payModal.total_cost || 0).toFixed(2)} MAD</span>
                  </div>
                </div>

                <div className="space-y-2 mb-5">
                  <p className="text-sm font-semibold text-gray-700">Methode de paiement</p>
                  {[
                    { value: 'CASH', label: 'Especes', icon: FiDollarSign, desc: 'Paiement immediat' },
                    { value: 'NFC_SOUKCARD', label: 'Carte Souk.AI', icon: FiSmartphone, desc: 'Scanner la carte NFC' },
                    { value: 'NFC_BANK', label: 'Carte bancaire', icon: FiCreditCard, desc: 'TPE / paiement NFC' },
                  ].map(m => (
                    <button
                      key={m.value}
                      onClick={() => setPayMethod(m.value)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition text-left ${
                        payMethod === m.value
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <m.icon className={`h-5 w-5 ${payMethod === m.value ? 'text-green-600' : 'text-gray-400'}`} />
                      <div>
                        <p className={`text-sm font-bold ${payMethod === m.value ? 'text-green-700' : 'text-gray-700'}`}>{m.label}</p>
                        <p className="text-xs text-gray-500">{m.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {payError && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 mb-4">{payError}</div>}

                <div className="flex gap-3">
                  <button
                    onClick={closePayModal}
                    className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-medium transition"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handlePay}
                    disabled={paying}
                    className="flex-1 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 text-sm font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {payMethod === 'NFC_SOUKCARD' && <FiSmartphone className="h-4 w-4" />}
                    {paying ? 'Paiement...' : payMethod === 'NFC_SOUKCARD' ? 'Scanner la carte' : 'Confirmer'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Step: NFC Waiting (scanning) ── */}
            {payStep === 'nfc_waiting' && (
              <div className="p-8 text-center space-y-5">
                <div className="relative w-36 h-36 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-purple-200 animate-ping opacity-30" />
                  <div className="absolute inset-3 rounded-full border-4 border-purple-300 animate-ping opacity-20" style={{ animationDelay: '0.5s' }} />
                  <div className="absolute inset-6 rounded-full border-4 border-purple-400 animate-ping opacity-10" style={{ animationDelay: '1s' }} />
                  <div className="absolute inset-8 rounded-full bg-gradient-to-br from-purple-100 to-violet-100 flex items-center justify-center shadow-inner">
                    <FiSmartphone className="h-12 w-12 text-purple-600" />
                  </div>
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">Approchez la carte Souk.AI</p>
                  <p className="text-sm text-gray-500 mt-1">Placez la carte sur le dos du telephone</p>
                  <p className="text-xs text-gray-400 mt-3">{Number(payModal.total_amount || 0).toFixed(2)} MAD</p>
                </div>
                <button onClick={() => { stopNfcScan(); setPayStep('select') }}
                  className="px-8 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200">Annuler</button>
              </div>
            )}

            {/* ── Step: Card Found — show info + PIN ── */}
            {payStep === 'card_found' && detectedCard && (
              <div className="p-6 space-y-4">
                {/* Card visual */}
                <div className="bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-700 rounded-2xl p-5 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10" />
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-8 -mb-8" />
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold tracking-widest opacity-80">SOUK.AI</span>
                    <FiSmartphone className="h-6 w-6 opacity-60" />
                  </div>
                  <p className="font-mono text-lg tracking-[0.25em] mb-3">
                    {detectedCard.card_number?.replace(/(.{4})/g, '$1 ').trim() || '****'}
                  </p>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider opacity-60">Titulaire</p>
                      <p className="font-bold text-sm">{detectedCard.holder_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider opacity-60">Solde</p>
                      <p className="font-black text-xl">{Number(detectedCard.balance || 0).toFixed(2)} <span className="text-xs">MAD</span></p>
                    </div>
                  </div>
                </div>

                {/* Balance check */}
                {detectedCard.balance < Number(payModal.total_amount || 0) && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex items-center gap-2">
                    <FiX className="h-4 w-4 flex-shrink-0" />
                    Solde insuffisant ({Number(detectedCard.balance).toFixed(2)} MAD &lt; {Number(payModal.total_amount || 0).toFixed(2)} MAD)
                  </div>
                )}

                {detectedCard.balance >= Number(payModal.total_amount || 0) && (
                  <>
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
                        <FiShield className="h-4 w-4 text-green-500" /> Entrez le code PIN
                      </p>
                      <div className="flex gap-1 justify-center">
                        {[0,1,2,3,4,5].map(i => (
                          <div key={i} className={`w-11 h-14 rounded-lg border-2 flex items-center justify-center text-2xl font-black ${
                            i < cardPin.length ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 bg-gray-50 text-gray-300'
                          }`}>
                            {i < cardPin.length ? '•' : ''}
                          </div>
                        ))}
                      </div>
                      <input ref={pinRef} type="tel" value={cardPin} autoFocus
                        onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setCardPin(v); setPayError('') }}
                        className="opacity-0 absolute -z-10 w-0 h-0"
                        onKeyDown={e => e.key === 'Enter' && cardPin.length >= 4 && confirmPinAndPay()} />
                      <button onClick={() => pinRef.current?.focus()} className="w-full text-center text-xs text-purple-600 mt-2 py-1">
                        Appuyez pour saisir le PIN
                      </button>
                    </div>

                    {payError && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{payError}</div>}

                    <button onClick={confirmPinAndPay} disabled={cardPin.length < 4}
                      className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-700 disabled:opacity-40 transition-all text-base flex items-center justify-center gap-2">
                      <FiCheckCircle className="h-5 w-5" />
                      Confirmer le paiement
                    </button>
                  </>
                )}

                <button onClick={() => { setPayStep('select'); setDetectedCard(null); setCardPin(''); setPayError('') }}
                  className="w-full py-2 text-gray-500 text-sm hover:text-gray-700">Annuler</button>
              </div>
            )}

            {/* ── Step: Processing ── */}
            {payStep === 'processing' && (
              <div className="p-12 text-center">
                <div className="w-20 h-20 mx-auto mb-4 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
                <p className="text-lg font-bold text-gray-900">Traitement en cours...</p>
                <p className="text-sm text-gray-500 mt-1">Ne fermez pas cette fenetre</p>
              </div>
            )}

            {/* ── Step: Success ── */}
            {payStep === 'success' && (
              <div className="p-12 text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                  <FiCheckCircle className="h-10 w-10 text-green-600" />
                </div>
                <p className="text-lg font-bold text-gray-900">Paiement reussi !</p>
                <p className="text-sm text-gray-500 mt-1">{Number(payModal.total_amount || 0).toFixed(2)} MAD</p>
              </div>
            )}

            {/* ── Step: Error ── */}
            {payStep === 'error' && (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                  <FiX className="h-8 w-8 text-red-600" />
                </div>
                <p className="text-lg font-bold text-gray-900">Erreur de paiement</p>
                {payError && <p className="text-sm text-red-600">{payError}</p>}
                <button onClick={() => { setPayStep('select'); setPayError('') }}
                  className="px-8 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200">Reessayer</button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* New Order Modal — Multi-product */}
      {orderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOrderModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Nouvelle commande</h3>
                <p className="text-xs text-gray-500">Ajoutez les produits et quantites</p>
              </div>
              <button onClick={() => setOrderModal(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                <FiX className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Supplier select */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Fournisseur</label>
                <select
                  value={orderSupplier}
                  onChange={e => setOrderSupplier(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Product search */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Ajouter des produits</label>
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    placeholder="Chercher un produit..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  />
                </div>
                {/* Search results dropdown */}
                {filteredProducts.length > 0 && (
                  <div className="mt-1 border border-gray-200 rounded-xl bg-white shadow-lg max-h-48 overflow-y-auto">
                    {filteredProducts.map(p => {
                      const already = orderItems.some(i => i.product_id === p.id)
                      return (
                        <button
                          key={p.id}
                          onClick={() => !already && addOrderItem(p)}
                          disabled={already}
                          className={`w-full text-left px-4 py-2.5 text-sm hover:bg-orange-50 border-b border-gray-50 last:border-0 flex items-center justify-between transition ${already ? 'opacity-40' : ''}`}
                        >
                          <span className="font-medium text-gray-800 truncate">{p.name_fr || p.name_ar}</span>
                          <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{Number(p.cost_price || 0).toFixed(2)} MAD</span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Add custom product button/form */}
                {!showCustomForm ? (
                  <button
                    onClick={() => setShowCustomForm(true)}
                    className="mt-2 flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700 font-medium"
                  >
                    <FiPlus className="h-4 w-4" /> Produit hors catalogue
                  </button>
                ) : (
                  <div className="mt-2 bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-bold text-orange-700 uppercase">Produit personnalise</p>
                    <input
                      value={customName}
                      onChange={e => setCustomName(e.target.value)}
                      placeholder="Nom du produit"
                      className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-400"
                    />
                    <input
                      type="number"
                      value={customPrice}
                      onChange={e => setCustomPrice(e.target.value)}
                      placeholder="Prix unitaire (MAD)"
                      min="0"
                      step="0.01"
                      className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-400"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => setShowCustomForm(false)} className="flex-1 py-2 text-sm text-gray-600 bg-white rounded-lg border border-gray-200 hover:bg-gray-50">Annuler</button>
                      <button onClick={addCustomItem} className="flex-1 py-2 text-sm text-white bg-orange-500 rounded-lg hover:bg-orange-600 font-semibold">Ajouter</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Selected items */}
              {orderItems.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                    Articles ({orderItems.length})
                  </label>
                  <div className="space-y-2">
                    {orderItems.map(item => {
                      const key = getItemKey(item)
                      return (
                        <div key={key} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${item.isCustom ? 'bg-orange-50 border border-orange-100' : 'bg-gray-50'}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
                              {item.isCustom && <span className="text-[9px] bg-orange-200 text-orange-700 px-1.5 py-0.5 rounded-full font-bold">CUSTOM</span>}
                            </div>
                            <p className="text-xs text-gray-500">{item.cost_price.toFixed(2)} MAD/u</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => updateItemQty(key, item.quantity - 1)}
                              className="w-7 h-7 flex items-center justify-center bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 text-sm font-bold"
                            >-</button>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={e => updateItemQty(key, parseInt(e.target.value) || 1)}
                              className="w-14 text-center border border-gray-200 rounded-lg py-1 text-sm font-bold outline-none focus:ring-1 focus:ring-orange-400"
                              min="1"
                            />
                            <button
                              onClick={() => updateItemQty(key, item.quantity + 1)}
                              className="w-7 h-7 flex items-center justify-center bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 text-sm font-bold"
                            >+</button>
                          </div>
                          <p className="text-sm font-bold text-gray-900 w-20 text-right">
                            {(item.quantity * item.cost_price).toFixed(2)}
                          </p>
                          <button
                            onClick={() => removeItem(key)}
                            className="p-1.5 hover:bg-red-100 rounded-lg transition"
                          >
                            <FiTrash2 className="h-3.5 w-3.5 text-red-500" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Total */}
              {orderItems.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">Total commande</span>
                  <span className="text-xl font-black text-orange-700">{orderTotal.toFixed(2)} MAD</span>
                </div>
              )}

              {/* Empty state */}
              {orderItems.length === 0 && (
                <div className="text-center py-6 text-gray-400">
                  <FiPackage className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Cherchez et ajoutez des produits</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex gap-3 rounded-b-2xl">
              <button
                onClick={() => setOrderModal(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-medium transition"
              >
                Annuler
              </button>
              <button
                onClick={handlePlaceOrder}
                disabled={ordering || orderItems.length === 0}
                className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 text-sm font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <FiShoppingCart className="h-4 w-4" />
                {ordering ? 'Envoi...' : `Commander (${orderItems.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete ORDER confirmation modal */}
      {deleteOrderConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteOrderConfirm(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <FiTrash2 className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Supprimer la commande ?</h3>
              <p className="text-sm text-gray-500 mt-2">
                Commande de <strong>{deleteOrderConfirm.supplier_name}</strong> — {Number(deleteOrderConfirm.total_amount || 0).toFixed(2)} MAD
              </p>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeleteOrderConfirm(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-medium transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDeleteOrder(deleteOrderConfirm)}
                disabled={deletingOrder}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {deletingOrder ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete SUPPLIER confirmation modal */}
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
