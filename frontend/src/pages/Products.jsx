import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiAlertCircle, FiCamera, FiCheck, FiX, FiRefreshCw, FiZap } from 'react-icons/fi'
import { RiScanLine, RiBarcodeLine } from 'react-icons/ri'
import { productsAPI, inventoryAPI } from '../api/client'
import toast from 'react-hot-toast'

/* ─── Helpers ─────────────────────────────────────────────────────────── */
function normalizeName(name = '') {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractPackSize(name = '') {
  const m = name.match(/\*\s*(\d+)/i)
  return m ? parseInt(m[1], 10) : 1
}

function namesAreSimilar(a, b) {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const wa = na.split(' ').filter(w => w.length > 2)
  const wb = nb.split(' ').filter(w => w.length > 2)
  if (!wa.length || !wb.length) return na.includes(nb) || nb.includes(na)
  const common = wa.filter(w => wb.includes(w))
  return common.length >= Math.ceil(Math.min(wa.length, wb.length) * 0.6)
}

export default function Products() {
  const [products, setProducts]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId]       = useState(null)
  const [search, setSearch]       = useState('')
  const [form, setForm]           = useState({ name_ar: '', name_fr: '', barcode: '', unit: 'piece', unit_price: '', cost_price: '' })

  /* ── Scan invoice state ── */
  const [showScanModal, setShowScanModal]   = useState(false)
  const [scanLoading, setScanLoading]       = useState(false)
  const [scanItems, setScanItems]           = useState([])   // extracted rows
  const [scanSelected, setScanSelected]    = useState({})   // id → bool
  const [importing, setImporting]           = useState(false)
  const fileInputRef = useRef(null)

  /* ── Barcode camera scanner state ── */
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [scannerError, setScannerError]             = useState('')
  const [scannerDetected, setScannerDetected]       = useState(null)
  const videoRef        = useRef(null)
  const streamRef       = useRef(null)
  const detectorRef     = useRef(null)
  const scanIntervalRef = useRef(null)

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
    const { name, value, type } = e.target
    if (['unit_price', 'cost_price', 'stock_quantity'].includes(name)) {
      // Allow empty, digits, and one decimal point — prevent browser blocking "0" deletion
      const cleaned = value.replace(',', '.')
      if (cleaned === '' || /^\d*\.?\d*$/.test(cleaned)) {
        setForm({ ...form, [name]: cleaned })
      }
    } else if (type === 'number') {
      setForm({ ...form, [name]: value === '' ? '' : parseFloat(value) })
    } else {
      setForm({ ...form, [name]: value })
    }
  }

  const openAdd = () => {
    setEditId(null)
    setForm({ name_ar: '', name_fr: '', barcode: '', unit: 'piece', unit_price: '', cost_price: '', stock_quantity: '' })
    setShowModal(true)
  }

  const openEdit = (p) => {
    setEditId(p.id)
    setForm({ name_ar: p.name_ar, name_fr: p.name_fr, barcode: p.barcode || '', unit: p.unit, unit_price: p.unit_price || '', cost_price: p.cost_price || '', stock_quantity: p.stock_quantity ?? '' })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editId) {
        const product = products.find(p => p.id === editId)
        const { stock_quantity, ...productData } = form
        const cleanData = { ...productData, unit_price: parseFloat(productData.unit_price) || 0, cost_price: parseFloat(productData.cost_price) || 0 }
        await productsAPI.update(editId, cleanData)
        const delta = Math.round(parseFloat(stock_quantity) || 0) - Math.round(product?.stock_quantity ?? 0)
        if (delta !== 0) {
          await inventoryAPI.adjust({
            product_id: editId,
            quantity_change: delta,
            reason: `Ajustement manuel (${delta > 0 ? '+' : ''}${delta})`,
          })
        }
        toast.success('Produit mis à jour')
      } else {
        const { stock_quantity, ...productData } = form
        const cleanData = { ...productData, unit_price: parseFloat(productData.unit_price) || 0, cost_price: parseFloat(productData.cost_price) || 0 }
        await productsAPI.create({ ...cleanData, initial_stock: parseFloat(stock_quantity) || 0 })
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

  /* ── Barcode camera scanner handlers ── */
  const openBarcodeScanner = useCallback(async () => {
    setScannerError('')
    setScannerDetected(null)
    setShowBarcodeScanner(true)

    if (!('BarcodeDetector' in window)) {
      setScannerError('Votre navigateur ne supporte pas le scan. Utilisez Chrome sur Android.')
      return
    }

    try {
      detectorRef.current = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e'] })
    } catch {
      setScannerError('Impossible de créer le détecteur de code-barres.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch {
      setScannerError('Accès caméra refusé. Autorisez la caméra dans les paramètres du navigateur.')
      return
    }

    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return
      try {
        const codes = await detectorRef.current.detect(videoRef.current)
        if (codes.length > 0) {
          const code = codes[0].rawValue
          setScannerDetected(code)
          closeBarcodeScanner()
          setForm(prev => ({ ...prev, barcode: code }))
          toast.success(`Code-barres détecté: ${code}`)
        }
      } catch { /* ignore frame errors */ }
    }, 300)
  }, []) // eslint-disable-line

  const closeBarcodeScanner = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setShowBarcodeScanner(false)
    setScannerError('')
  }, [])

  /* ── Scan invoice handlers ── */
  const handleScanFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScanLoading(true)
    setScanItems([])
    setScanSelected({})
    setShowScanModal(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const token = localStorage.getItem('token')
      const res = await fetch('/api/v1/products/scan-invoice', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      const items = (data.items || []).map((it, i) => ({ ...it, _id: i }))
      setScanItems(items)
      // select all by default
      const sel = {}
      items.forEach(it => { sel[it._id] = true })
      setScanSelected(sel)
    } catch (err) {
      toast.error('Erreur analyse facture')
      setShowScanModal(false)
    } finally {
      setScanLoading(false)
      e.target.value = ''
    }
  }

  // Compute match + pack size metadata for each scanned item
  const scanItemMeta = useMemo(() => {
    const map = {}
    scanItems.forEach(it => {
      const packSize = extractPackSize(it.name)
      const effectiveQty = (it.quantity || 1) * packSize
      const matchedProduct = products.find(p =>
        namesAreSimilar(p.name_ar, it.name) ||
        namesAreSimilar(p.name_fr, it.name)
      ) || null
      map[it._id] = { packSize, effectiveQty, matchedProduct, isNew: !matchedProduct }
    })
    return map
  }, [scanItems, products])

  const handleImportSelected = async () => {
    const toImport = scanItems.filter(it => scanSelected[it._id])
    if (!toImport.length) return toast.error('Sélectionnez au moins un produit')
    setImporting(true)
    let created = 0, updated = 0, failed = 0

    for (const it of toImport) {
      const { matchedProduct, effectiveQty } = scanItemMeta[it._id]
      try {
        if (matchedProduct) {
          // Update prices
          await productsAPI.update(matchedProduct.id, {
            unit_price: it.unit_price || matchedProduct.unit_price,
            cost_price: it.cost_price || matchedProduct.cost_price,
          })
          // Add stock received
          await inventoryAPI.adjust({
            product_id: matchedProduct.id,
            quantity_change: effectiveQty,
            reason: `Réception fournisseur (+${effectiveQty})`,
          })
          updated++
        } else {
          await productsAPI.create({
            name_ar: it.name,
            name_fr: it.name,
            barcode: '',
            unit: 'piece',
            unit_price: it.unit_price || 0,
            cost_price: it.cost_price || 0,
            initial_stock: effectiveQty,
          })
          created++
        }
      } catch {
        failed++
      }
    }

    setImporting(false)
    setShowScanModal(false)
    loadProducts()
    const parts = []
    if (created) parts.push(`${created} créé(s)`)
    if (updated) parts.push(`${updated} mis à jour`)
    if (failed) parts.push(`${failed} échoué(s)`)
    toast.success(parts.join(' · ') || 'Import terminé')
  }

  const toggleAll = (val) => {
    const sel = {}
    scanItems.forEach(it => { sel[it._id] = val })
    setScanSelected(sel)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" /></div>
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produits</h1>
          <p className="text-sm text-gray-500 mt-0.5">{products.length} produit(s) au total</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Scan invoice button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm font-medium shadow-sm"
          >
            <RiScanLine className="h-4 w-4" />
            Scan Facture
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleScanFile} />

          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors text-sm font-medium shadow-sm"
          >
            <FiPlus className="h-4 w-4" /> Ajouter
          </button>
        </div>
      </div>

      {/* ── Price warning ── */}
      {noPriceCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <FiAlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">{noPriceCount} produit(s) sans prix défini</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Cliquez sur ✏️ pour définir le prix, ou via WhatsApp: <span className="font-mono bg-amber-100 px-1 rounded">"sardines 10 DH"</span>
            </p>
          </div>
        </div>
      )}

      {/* ── Search ── */}
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Rechercher parmi ${products.length} produits...`}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
        />
      </div>

      {/* ── Table ── */}
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

      {/* ── Add/Edit Modal ── */}
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
                  <div className="flex gap-1.5">
                    <input name="barcode" value={form.barcode} onChange={handleChange} placeholder="Optionnel"
                      className="flex-1 min-w-0 px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm" />
                    <button type="button" onClick={openBarcodeScanner} title="Scanner avec la caméra"
                      className="flex-shrink-0 px-2.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors">
                      <RiBarcodeLine className="h-4 w-4 text-emerald-600" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Prix vente (MAD)</label>
                  <input name="unit_price" type="text" inputMode="decimal" placeholder="0.00" value={form.unit_price} onChange={handleChange}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Prix achat (MAD)</label>
                  <input name="cost_price" type="text" inputMode="decimal" placeholder="0.00" value={form.cost_price} onChange={handleChange}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    {editId ? 'Stock actuel' : 'Stock initial'}
                  </label>
                  <input name="stock_quantity" type="text" inputMode="numeric" placeholder="0"
                    value={form.stock_quantity} onChange={handleChange}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm" />
                  {editId && (() => {
                    const orig = products.find(p => p.id === editId)?.stock_quantity ?? 0
                    const delta = Math.round(parseFloat(form.stock_quantity) || 0) - Math.round(orig)
                    if (delta === 0) return null
                    return (
                      <p className={`text-xs mt-1 font-medium ${delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {delta > 0 ? '+' : ''}{delta} unité(s)
                      </p>
                    )
                  })()}
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

      {/* ── Barcode Scanner Modal ── */}
      {showBarcodeScanner && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <RiBarcodeLine className="h-5 w-5 text-emerald-600" />
                <span className="font-bold text-gray-900 text-sm">Scanner code-barres</span>
              </div>
              <button onClick={closeBarcodeScanner} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <FiX className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            <div className="p-5">
              {scannerError ? (
                <div className="text-center py-6">
                  <FiAlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
                  <p className="text-sm text-red-600 font-medium mb-1">Scanner non disponible</p>
                  <p className="text-xs text-gray-500 mb-4">{scannerError}</p>
                  <p className="text-xs text-gray-400">Entrez le code manuellement ci-dessus</p>
                </div>
              ) : (
                <>
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    {/* Aiming reticle */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-24 border-2 border-emerald-400 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                        <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-emerald-300 rounded-tl" />
                        <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-emerald-300 rounded-tr" />
                        <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-emerald-300 rounded-bl" />
                        <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-emerald-300 rounded-br" />
                        <div className="absolute inset-x-0 top-1/2 h-0.5 bg-emerald-400/60 animate-pulse" />
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-xs text-gray-500 mt-3 flex items-center justify-center gap-1.5">
                    <FiZap className="h-3.5 w-3.5 text-emerald-500" />
                    Pointez la caméra vers le code-barres
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Scan Invoice Modal ── */}
      {showScanModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-xl">
                  <RiScanLine className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Scan Facture Fournisseur</h2>
                  <p className="text-xs text-gray-400">Import automatique via IA (GPT-4o Vision)</p>
                </div>
              </div>
              <button onClick={() => setShowScanModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <FiX className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {scanLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center">
                      <FiCamera className="h-8 w-8 text-emerald-500 animate-pulse" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-gray-800">Analyse en cours...</p>
                    <p className="text-sm text-gray-400 mt-1">GPT-4o Vision extrait les produits de votre facture</p>
                  </div>
                </div>
              ) : scanItems.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-sm">Aucun produit extrait. Réessayez avec une image plus nette.</p>
                </div>
              ) : (
                <>
                  {/* Select all / count */}
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-700">
                      {Object.values(scanSelected).filter(Boolean).length} / {scanItems.length} produits sélectionnés
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => toggleAll(true)} className="text-xs text-violet-600 hover:underline font-semibold">Tout sélectionner</button>
                      <span className="text-gray-300">·</span>
                      <button onClick={() => toggleAll(false)} className="text-xs text-gray-400 hover:underline">Désélectionner</button>
                    </div>
                  </div>

                  {/* Product rows */}
                  <div className="space-y-2">
                    {scanItems.map((it) => {
                      const meta = scanItemMeta[it._id] || {}
                      const { packSize = 1, effectiveQty = it.quantity, matchedProduct, isNew = true } = meta
                      return (
                        <label
                          key={it._id}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            scanSelected[it._id]
                              ? 'border-emerald-300 bg-emerald-50'
                              : 'border-gray-100 bg-gray-50 opacity-60'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={!!scanSelected[it._id]}
                            onChange={e => setScanSelected({ ...scanSelected, [it._id]: e.target.checked })}
                            className="rounded text-emerald-500 w-4 h-4 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-gray-800 truncate">{it.name}</p>
                              {isNew ? (
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700 flex-shrink-0">NOUVEAU</span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-700 flex-shrink-0 flex items-center gap-1">
                                  <FiRefreshCw className="h-2.5 w-2.5" /> MISE À JOUR
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {packSize > 1
                                ? `${it.quantity} carton(s) × ${packSize} = `
                                : 'Qté: '}
                              <span className="font-semibold text-gray-600">{effectiveQty} unité(s)</span>
                              {' · '}Prix vente: {it.unit_price ? `${Number(it.unit_price).toFixed(2)} MAD` : '—'}
                              {' · '}Prix achat: {it.cost_price ? `${Number(it.cost_price).toFixed(2)} MAD` : '—'}
                              {matchedProduct && (
                                <span className="text-blue-500"> · correspond à "{matchedProduct.name_fr}"</span>
                              )}
                            </p>
                          </div>
                          {scanSelected[it._id] && (
                            <FiCheck className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                          )}
                        </label>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {!scanLoading && scanItems.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                <button
                  onClick={() => setShowScanModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleImportSelected}
                  disabled={importing || !Object.values(scanSelected).some(Boolean)}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {importing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Import en cours...
                    </>
                  ) : (
                    (() => {
                      const sel = scanItems.filter(it => scanSelected[it._id])
                      const newCount = sel.filter(it => scanItemMeta[it._id]?.isNew).length
                      const updCount = sel.filter(it => !scanItemMeta[it._id]?.isNew).length
                      return (
                        <>
                          <FiCheck className="h-4 w-4" />
                          {newCount > 0 && `${newCount} nouveau(x)`}
                          {newCount > 0 && updCount > 0 && ' · '}
                          {updCount > 0 && `${updCount} mise(s) à jour`}
                        </>
                      )
                    })()
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
