import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiAlertCircle, FiCamera, FiCheck, FiX, FiRefreshCw, FiZap, FiCopy, FiFilter, FiClock } from 'react-icons/fi'
import { RiScanLine, RiBarcodeLine } from 'react-icons/ri'
import { productsAPI, inventoryAPI, merchantsAPI } from '../api/client'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useMoney } from '../utils/money'
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
  const { t } = useTranslation()
  const money = useMoney()
  const { merchant } = useAuth()
  const currency = merchant?.currency || 'MAD'
  const [taxInfo, setTaxInfo] = useState({ label: 'TVA', rates: [] })
  useEffect(() => { merchantsAPI.taxRates().then(r => setTaxInfo(r.data)).catch(() => {}) }, [])
  const [products, setProducts]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId]       = useState(null)
  const [search, setSearch]       = useState('')
  const [form, setForm]           = useState({ name_ar: '', name_fr: '', barcode: '', unit: 'piece', unit_price: '', cost_price: '', tax_rate: '', manufacture_date: '', expiry_date: '' })
  const [filterGroup, setFilterGroup] = useState('')  // Smart group filter
  const [expiringProducts, setExpiringProducts] = useState([])

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
      .catch(() => toast.error(t('common.error')))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadProducts() }, [])

  const filtered = useMemo(() => {
    let list = products
    // Apply search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.name_ar?.toLowerCase().includes(q) ||
        p.name_fr?.toLowerCase().includes(q) ||
        p.barcode?.includes(q)
      )
    }
    // Apply group filter (smart keyword match on product names)
    if (filterGroup) {
      const g = filterGroup.toLowerCase()
      list = list.filter(p =>
        p.name_ar?.toLowerCase().includes(g) ||
        p.name_fr?.toLowerCase().includes(g)
      )
    }
    return list
  }, [products, search, filterGroup])

  // Extract unique product groups/categories from names (first word or common keywords)
  const productGroups = useMemo(() => {
    const groupMap = {}
    products.forEach(p => {
      const name = (p.name_fr || p.name_ar || '').toLowerCase()
      // Extract meaningful first word (>2 chars)
      const words = name.split(/[\s,\-\/]+/).filter(w => w.length > 2)
      if (words[0]) {
        const key = words[0]
        groupMap[key] = (groupMap[key] || 0) + 1
      }
    })
    // Only show groups with 2+ products, sorted by count
    return Object.entries(groupMap)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name, count]) => ({ name, count }))
  }, [products])

  const noPriceCount = products.filter(p => !p.unit_price || p.unit_price === 0).length

  // Load expiring products
  useEffect(() => {
    import('../api/client').then(({ barcodeAPI }) => {
      barcodeAPI.expiring(3).then(r => setExpiringProducts(r.data || [])).catch(() => {})
    })
  }, [products])

  /* ── Dismissed duplicates (persisted per session) ── */
  const [dismissedDups, setDismissedDups] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dismissed_dups') || '[]') } catch { return [] }
  })
  const dismissDup = (a, b) => {
    const key = [a.id, b.id].sort().join(':')
    const next = [...dismissedDups, key]
    setDismissedDups(next)
    localStorage.setItem('dismissed_dups', JSON.stringify(next))
  }

  /* ── Duplicate detection (Arabic ↔ French) ── */
  const duplicates = useMemo(() => {
    const pairs = []
    const used = new Set()
    const dismissedSet = new Set(dismissedDups)
    for (let i = 0; i < products.length; i++) {
      if (used.has(products[i].id)) continue
      for (let j = i + 1; j < products.length; j++) {
        if (used.has(products[j].id)) continue
        const a = products[i], b = products[j]
        // Skip dismissed pairs
        const pairKey = [a.id, b.id].sort().join(':')
        if (dismissedSet.has(pairKey)) continue
        let isDup = false
        // Same barcode (both non-empty)
        if (a.barcode && b.barcode && a.barcode === b.barcode) isDup = true
        // Same unit + same prices + similar name (need at least name hint)
        if (!isDup && a.unit === b.unit && a.unit_price > 0 && b.unit_price > 0 && a.unit_price === b.unit_price && a.cost_price === b.cost_price) {
          // Price match alone is not enough — require name similarity or same barcode
          if (namesAreSimilar(a.name_fr, b.name_fr) || namesAreSimilar(a.name_ar, b.name_ar)
              || namesAreSimilar(a.name_fr, b.name_ar) || namesAreSimilar(a.name_ar, b.name_fr)) {
            isDup = true
          }
        }
        // Name similarity (Latin or Arabic)
        if (!isDup && (namesAreSimilar(a.name_fr, b.name_fr) || namesAreSimilar(a.name_ar, b.name_ar))) isDup = true
        // Cross-language name similarity (Arabic name vs French name)
        if (!isDup && (namesAreSimilar(a.name_ar, b.name_fr) || namesAreSimilar(a.name_fr, b.name_ar))) isDup = true
        if (isDup) {
          pairs.push([a, b])
          used.add(a.id)
          used.add(b.id)
          break
        }
      }
    }
    return pairs
  }, [products, dismissedDups])

  const [merging, setMerging] = useState(null)
  const handleMerge = async (keep, remove) => {
    setMerging(keep.id + remove.id)
    try {
      await productsAPI.merge(keep.id, remove.id)
      toast.success(`"${keep.name_fr || keep.name_ar}" fusionné — doublon supprimé`)
      loadProducts()
    } catch (err) {
      toast.error(err.response?.data?.detail || t('common.error'))
    } finally {
      setMerging(null)
    }
  }

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

  /* ── Inline expiry date editing ── */
  const [editingExpiry, setEditingExpiry] = useState(null) // product id being edited

  const handleExpiryInline = async (productId, newDate) => {
    setEditingExpiry(null)
    try {
      await productsAPI.update(productId, { expiry_date: newDate || null })
      toast.success(t('products.expiryUpdated'))
      loadProducts()
    } catch {
      toast.error(t('common.error'))
    }
  }

  const openAdd = () => {
    setEditId(null)
    setForm({ name_ar: '', name_fr: '', barcode: '', unit: 'piece', unit_price: '', cost_price: '', tax_rate: '', stock_quantity: '', manufacture_date: '', expiry_date: '' })
    setShowModal(true)
  }

  const openEdit = (p) => {
    setEditId(p.id)
    setForm({ name_ar: p.name_ar, name_fr: p.name_fr, barcode: p.barcode || '', unit: p.unit, unit_price: p.unit_price || '', cost_price: p.cost_price || '', tax_rate: p.tax_rate ?? '', stock_quantity: p.stock_quantity ?? '', manufacture_date: p.manufacture_date || '', expiry_date: p.expiry_date || '' })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editId) {
        const product = products.find(p => p.id === editId)
        const { stock_quantity, ...productData } = form
        const cleanData = { ...productData, unit_price: parseFloat(productData.unit_price) || 0, cost_price: parseFloat(productData.cost_price) || 0, manufacture_date: productData.manufacture_date || null, expiry_date: productData.expiry_date || null, tax_rate: productData.tax_rate === '' || productData.tax_rate == null ? null : parseFloat(productData.tax_rate) }
        await productsAPI.update(editId, cleanData)
        const delta = Math.round(parseFloat(stock_quantity) || 0) - Math.round(product?.stock_quantity ?? 0)
        if (delta !== 0) {
          await inventoryAPI.adjust({
            product_id: editId,
            quantity_change: delta,
            reason: `Ajustement manuel (${delta > 0 ? '+' : ''}${delta})`,
          })
        }
        toast.success(t('products.updated'))
      } else {
        const { stock_quantity, ...productData } = form
        const cleanData = { ...productData, unit_price: parseFloat(productData.unit_price) || 0, cost_price: parseFloat(productData.cost_price) || 0, manufacture_date: productData.manufacture_date || null, expiry_date: productData.expiry_date || null, tax_rate: productData.tax_rate === '' || productData.tax_rate == null ? null : parseFloat(productData.tax_rate) }
        await productsAPI.create({ ...cleanData, initial_stock: parseFloat(stock_quantity) || 0 })
        toast.success(t('products.added'))
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
      toast.success(t('products.deleted'))
      loadProducts()
    } catch {
      toast.error(t('common.error'))
    }
  }

  /* ── Barcode camera scanner handlers ── */
  const openBarcodeScanner = useCallback(async () => {
    setScannerError('')
    setScannerDetected(null)
    setShowBarcodeScanner(true)

    if (!('BarcodeDetector' in window)) {
      setScannerError(t('products.scanUnsupported'))
      return
    }

    try {
      detectorRef.current = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e'] })
    } catch {
      setScannerError(t('products.scanUnsupported'))
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
          toast.success(t('products.barcodeDetected', { code }))
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
      toast.error(t('products.scanError'))
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
    if (!toImport.length) return toast.error(t('products.selectOne'))
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
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.productsStock')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('products.total', { count: products.length })}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Scan invoice button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm font-medium shadow-sm"
          >
            <RiScanLine className="h-4 w-4" />
            {t('products.scanInvoiceBtn')}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleScanFile} />

          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors text-sm font-medium shadow-sm"
          >
            <FiPlus className="h-4 w-4" /> {t('common.add')}
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

      {/* ── Duplicate warning ── */}
      {duplicates.length > 0 && (
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FiCopy className="h-5 w-5 text-brand-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-brand-800">{duplicates.length} doublon(s) detecte(s)</p>
              <p className="text-xs text-brand-600">Des produits semblent etre en double (arabe / francais). Fusionnez-les pour eviter la confusion.</p>
            </div>
          </div>
          {duplicates.map(([a, b]) => {
            const keepA = (a.unit_price > 0 || a.stock_quantity > 0)
            const keep = keepA ? a : b
            const remove = keepA ? b : a
            return (
              <div key={a.id + b.id} className="flex items-center gap-3 bg-white rounded-lg p-3 border border-brand-100">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">{a.name_ar || a.name_fr}</span>
                    <span className="text-xs text-gray-500">=</span>
                    <span className="text-sm font-semibold text-gray-800">{b.name_fr || b.name_ar}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t('common.price')}: {a.unit_price > 0 ? money(a.unit_price) : t('products.missing')}
                    {' / '}
                    {b.unit_price > 0 ? money(b.unit_price) : t('products.missing')}
                    {' · Stock: '}{a.stock_quantity ?? 0}{' / '}{b.stock_quantity ?? 0}
                  </p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleMerge(keep, remove)}
                    disabled={merging === keep.id + remove.id}
                    className="px-3 py-1.5 bg-brand-600 text-white text-xs font-bold rounded-lg hover:bg-brand-700 transition disabled:opacity-50"
                  >
                    {merging === keep.id + remove.id ? '...' : 'Fusionner'}
                  </button>
                  <button
                    onClick={() => dismissDup(a, b)}
                    className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    title={t('products.notDuplicate')}
                  >
                    <FiX className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Expiry Alert ── */}
      {expiringProducts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <FiClock className="h-5 w-5 text-red-500" />
            <p className="text-sm font-bold text-red-800">
              {t('products.expiringSoon', { count: expiringProducts.length })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {expiringProducts.slice(0, 8).map(p => (
              <span key={p.id} className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                p.expired ? 'bg-red-200 text-red-800' : 'bg-orange-100 text-orange-700'
              }`}>
                {p.expired ? '❌' : '⏰'} {p.name_fr || p.name_ar} {p.days_left !== null ? `(${t('dashboard.days', { count: p.days_left })})` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Search + Filters ── */}
      <div className="space-y-3">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 h-4 w-4" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('products.searchAmong', { count: products.length })}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
          />
        </div>
        {/* Smart group filters */}
        {productGroups.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <FiFilter className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
            <button
              onClick={() => setFilterGroup('')}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                !filterGroup ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Tous ({products.length})
            </button>
            {productGroups.map(g => (
              <button
                key={g.name}
                onClick={() => setFilterGroup(filterGroup === g.name ? '' : g.name)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition capitalize ${
                  filterGroup === g.name ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {g.name} ({g.count})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('customers.product')}</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('products.unit')}</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('products.salePrice')}</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('pos.stock')}</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('dashboard.expiry')}</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('common.actions')}</th>
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
                        <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-sm font-bold text-brand-600 flex-shrink-0">
                          {(p.name_ar || p.name_fr || '?')[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{p.name_ar}</p>
                          {p.name_fr !== p.name_ar && <p className="text-xs text-gray-500">{p.name_fr}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{t(`products.units.${p.unit}`, { defaultValue: p.unit })}</td>
                    <td className="px-5 py-3.5">
                      {hasNoPrice ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium">
                          <FiAlertCircle className="h-3 w-3" /> Prix manquant
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-gray-800">{money(p.unit_price)}</span>
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
                    <td className="px-5 py-3.5">
                      {editingExpiry === p.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="date"
                            defaultValue={p.expiry_date || ''}
                            autoFocus
                            onBlur={(e) => handleExpiryInline(p.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleExpiryInline(p.id, e.target.value)
                              if (e.key === 'Escape') setEditingExpiry(null)
                            }}
                            className="w-32 px-2 py-1 border border-brand-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 outline-none"
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingExpiry(p.id)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                            !p.expiry_date
                              ? 'text-gray-500 hover:bg-gray-100'
                              : (() => {
                                  const today = new Date()
                                  today.setHours(0,0,0,0)
                                  const exp = new Date(p.expiry_date + 'T00:00:00')
                                  const diff = Math.ceil((exp - today) / 86400000)
                                  if (diff <= 0) return 'bg-red-100 text-red-700 hover:bg-red-200'
                                  if (diff <= 7) return 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                  if (diff <= 30) return 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                  return 'bg-green-50 text-green-700 hover:bg-green-100'
                                })()
                          }`}
                          title={t('common.edit')}
                        >
                          {!p.expiry_date ? (
                            <span className="flex items-center gap-1"><FiClock className="h-3 w-3" /> —</span>
                          ) : (() => {
                            const today = new Date()
                            today.setHours(0,0,0,0)
                            const exp = new Date(p.expiry_date + 'T00:00:00')
                            const diff = Math.ceil((exp - today) / 86400000)
                            const dateStr = exp.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                            if (diff <= 0) return <><span>❌</span> {dateStr}</>
                            if (diff <= 3) return <><span>🔴</span> {dateStr} ({t('dashboard.days', { count: diff })})</>
                            if (diff <= 7) return <><span>🟠</span> {dateStr} ({t('dashboard.days', { count: diff })})</>
                            if (diff <= 30) return <><span>🟡</span> {dateStr} ({t('dashboard.days', { count: diff })})</>
                            return <><span>✅</span> {dateStr}</>
                          })()}
                        </button>
                      )}
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
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
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
            <h2 className="text-xl font-bold mb-5 text-gray-900">{editId ? t('products.editTitle') : t('products.addTitle')}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{t('products.nameAr')} *</label>
                  <input name="name_ar" value={form.name_ar} onChange={handleChange} placeholder="طماطم" required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{t('products.nameFr')} *</label>
                  <input name="name_fr" value={form.name_fr} onChange={handleChange} placeholder="Tomates" required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{t('products.unit')}</label>
                  <select name="unit" value={form.unit} onChange={handleChange}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm">
                    <option value="piece">{t('products.units.piece')}</option>
                    <option value="kg">{t('products.units.kg')}</option>
                    <option value="litre">{t('products.units.litre')}</option>
                    <option value="carton">{t('products.units.carton')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{t('products.barcode')}</label>
                  <div className="flex gap-1.5">
                    <input name="barcode" value={form.barcode} onChange={handleChange} placeholder={t('products.optional')}
                      className="flex-1 min-w-0 px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm" />
                    <button type="button" onClick={openBarcodeScanner} title={t('products.scanCamera')} aria-label={t('products.scanCamera')}
                      className="flex-shrink-0 px-2.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors">
                      <RiBarcodeLine className="h-4 w-4 text-emerald-600" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{t('products.salePrice')} ({currency})</label>
                  <input name="unit_price" type="text" inputMode="decimal" placeholder="0.00" value={form.unit_price} onChange={handleChange}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{t('products.costPrice')} ({currency})</label>
                  <input name="cost_price" type="text" inputMode="decimal" placeholder="0.00" value={form.cost_price} onChange={handleChange}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm" />
                </div>
              </div>
              <div>
                <label htmlFor="tax_rate" className="text-xs font-medium text-gray-600 mb-1 block">
                  {taxInfo.label} {t('products.taxIncluded')}
                </label>
                <select id="tax_rate" name="tax_rate" value={form.tax_rate ?? ''} onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm bg-white">
                  <option value="">{t('products.taxUnset')}</option>
                  {taxInfo.rates.map(r => <option key={r} value={r}>{r} %</option>)}
                  {form.tax_rate !== '' && form.tax_rate != null && !taxInfo.rates.includes(Number(form.tax_rate)) &&
                    <option value={form.tax_rate}>{form.tax_rate} %</option>}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    {editId ? t('products.currentStock') : t('products.initialStock')}
                  </label>
                  <input name="stock_quantity" type="text" inputMode="numeric" placeholder="0"
                    value={form.stock_quantity} onChange={handleChange}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm" />
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{t('products.mfgDate')}</label>
                  <input name="manufacture_date" type="date" value={form.manufacture_date} onChange={handleChange}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{t('products.expiryDate')}</label>
                  <input name="expiry_date" type="date" value={form.expiry_date} onChange={handleChange}
                    className={`w-full px-3 py-2.5 border rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm ${
                      form.expiry_date && new Date(form.expiry_date) <= new Date() ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`} />
                  {form.expiry_date && (() => {
                    const today = new Date(); today.setHours(0,0,0,0)
                    const exp = new Date(form.expiry_date + 'T00:00:00')
                    const diff = Math.ceil((exp - today) / 86400000)
                    if (diff <= 0) return <p className="text-xs mt-1 font-medium text-red-600">❌ {t('pos.expired')}</p>
                    if (diff <= 7) return <p className="text-xs mt-1 font-medium text-orange-600">⚠️ Expire dans {diff} jour(s)</p>
                    return null
                  })()}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-medium text-gray-700">
                  {t('common.cancel')}
                </button>
                <button type="submit"
                  className="flex-1 py-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 text-sm font-medium">
                  {editId ? t('common.save') : t('common.add')}
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
                <span className="font-bold text-gray-900 text-sm">{t('products.scanBarcode')}</span>
              </div>
              <button onClick={closeBarcodeScanner} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <FiX className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            <div className="p-5">
              {scannerError ? (
                <div className="text-center py-6">
                  <FiAlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
                  <p className="text-sm text-red-600 font-medium mb-1">{t('products.scannerUnavailable')}</p>
                  <p className="text-xs text-gray-500 mb-4">{scannerError}</p>
                  <p className="text-xs text-gray-500">{t('products.typeCode')}</p>
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
                  <h2 className="text-base font-bold text-gray-900">{t('products.invoiceScan')}</h2>
                  <p className="text-xs text-gray-500">{t('products.invoiceScanSub')}</p>
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
                    <p className="font-semibold text-gray-800">{t('products.analyzing')}</p>
                    <p className="text-sm text-gray-500 mt-1">{t('products.analyzingSub')}</p>
                  </div>
                </div>
              ) : scanItems.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-sm">{t('products.nothingExtracted')}</p>
                </div>
              ) : (
                <>
                  {/* Select all / count */}
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-700">
                      {Object.values(scanSelected).filter(Boolean).length} / {scanItems.length} produits sélectionnés
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => toggleAll(true)} className="text-xs text-brand-600 hover:underline font-semibold">{t('products.selectAll')}</button>
                      <span className="text-gray-300">·</span>
                      <button onClick={() => toggleAll(false)} className="text-xs text-gray-500 hover:underline">{t('products.selectNone')}</button>
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
                            <p className="text-xs text-gray-500 mt-0.5">
                              {packSize > 1
                                ? `${it.quantity} carton(s) × ${packSize} = `
                                : 'Qté: '}
                              <span className="font-semibold text-gray-600">{effectiveQty} unité(s)</span>
                              {' · '}{t('products.salePrice')}: {it.unit_price ? money(it.unit_price) : '—'}
                              {' · '}{t('products.costPrice')}: {it.cost_price ? money(it.cost_price) : '—'}
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
                  {t('common.cancel')}
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
