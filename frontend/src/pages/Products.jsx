import { useState, useEffect, useMemo, useRef } from 'react'
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiAlertCircle, FiCamera, FiCheck, FiX } from 'react-icons/fi'
import { RiScanLine } from 'react-icons/ri'
import { productsAPI } from '../api/client'
import toast from 'react-hot-toast'

export default function Products() {
  const [products, setProducts]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId]       = useState(null)
  const [search, setSearch]       = useState('')
  const [form, setForm]           = useState({ name_ar: '', name_fr: '', barcode: '', unit: 'piece', unit_price: 0, cost_price: 0 })

  /* ── Scan invoice state ── */
  const [showScanModal, setShowScanModal]   = useState(false)
  const [scanLoading, setScanLoading]       = useState(false)
  const [scanItems, setScanItems]           = useState([])   // extracted rows
  const [scanSelected, setScanSelected]    = useState({})   // id → bool
  const [importing, setImporting]           = useState(false)
  const fileInputRef = useRef(null)

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

  const handleImportSelected = async () => {
    const toImport = scanItems.filter(it => scanSelected[it._id])
    if (!toImport.length) return toast.error('Sélectionnez au moins un produit')
    setImporting(true)
    let created = 0, skipped = 0
    for (const it of toImport) {
      try {
        await productsAPI.create({
          name_ar: it.name,
          name_fr: it.name,
          barcode: '',
          unit: 'piece',
          unit_price: it.unit_price || 0,
          cost_price: it.cost_price || 0,
        })
        created++
      } catch {
        skipped++
      }
    }
    setImporting(false)
    setShowScanModal(false)
    loadProducts()
    toast.success(`${created} produit(s) importé(s)${skipped ? ` · ${skipped} ignoré(s)` : ''}`)
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
                    {scanItems.map((it) => (
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
                          <p className="text-sm font-semibold text-gray-800 truncate">{it.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Qté: {it.quantity} · Prix vente: {it.unit_price ? `${Number(it.unit_price).toFixed(2)} MAD` : '—'} · Prix achat: {it.cost_price ? `${Number(it.cost_price).toFixed(2)} MAD` : '—'}
                          </p>
                        </div>
                        {scanSelected[it._id] && (
                          <FiCheck className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                        )}
                      </label>
                    ))}
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
                    <>
                      <FiCheck className="h-4 w-4" />
                      Importer {Object.values(scanSelected).filter(Boolean).length} produit(s)
                    </>
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
