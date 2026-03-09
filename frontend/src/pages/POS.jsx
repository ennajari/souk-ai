import { useState, useEffect, useRef } from 'react'
import { FiSearch, FiPlus, FiMinus, FiTrash2, FiPrinter, FiX, FiShoppingCart } from 'react-icons/fi'
import { productsAPI, transactionsAPI } from '../api/client'
import toast from 'react-hot-toast'

export default function POS() {
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [lastReceipt, setLastReceipt] = useState(null)
  const searchRef = useRef()

  useEffect(() => {
    productsAPI.list()
      .then(r => setProducts(r.data))
      .catch(() => toast.error('Erreur chargement produits'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    // Focus search on load
    searchRef.current?.focus()
  }, [loading])

  const filtered = products.filter(p => {
    const q = search.toLowerCase()
    return (p.name_fr || '').toLowerCase().includes(q) ||
           (p.name_ar || '').toLowerCase().includes(q) ||
           (p.barcode || '').includes(q)
  })

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id)
      if (existing) {
        return prev.map(c => c.product.id === product.id ? { ...c, qty: c.qty + 1 } : c)
      }
      return [...prev, { product, qty: 1, price: product.unit_price || 0 }]
    })
  }

  const updateQty = (productId, delta) => {
    setCart(prev => prev.map(c => {
      if (c.product.id !== productId) return c
      const newQty = c.qty + delta
      return newQty > 0 ? { ...c, qty: newQty } : c
    }))
  }

  const updatePrice = (productId, price) => {
    setCart(prev => prev.map(c =>
      c.product.id === productId ? { ...c, price: parseFloat(price) || 0 } : c
    ))
  }

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(c => c.product.id !== productId))
  }

  const cartTotal = cart.reduce((s, c) => s + c.qty * c.price, 0)

  const handleCheckout = async () => {
    if (cart.length === 0) return toast.error('Le panier est vide')
    setProcessing(true)
    try {
      for (const item of cart) {
        await transactionsAPI.create({
          product_id: item.product.id,
          quantity: item.qty,
          unit_price: item.price,
          type: 'SALE',
          source: 'WEB',
        })
      }
      setLastReceipt({ items: [...cart], total: cartTotal, date: new Date() })
      setShowReceipt(true)
      setCart([])
      toast.success(`Vente enregistree: ${cartTotal.toFixed(2)} MAD`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de la vente')
    } finally {
      setProcessing(false)
    }
  }

  const printReceipt = () => {
    if (!lastReceipt) return
    const win = window.open('', '_blank', 'width=350,height=500')
    win.document.write(`
      <!DOCTYPE html>
      <html><head><title>Ticket de caisse</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; padding: 10px; font-size: 12px; max-width: 280px; margin: auto; }
        .header { text-align: center; border-bottom: 2px dashed #333; padding-bottom: 6px; margin-bottom: 6px; }
        .header h1 { font-size: 20px; font-weight: 900; letter-spacing: 2px; }
        .header p { font-size: 9px; color: #666; margin-top: 2px; }
        .date { text-align: center; font-size: 10px; color: #666; margin-bottom: 8px; }
        .sep { border-top: 1px dashed #ccc; margin: 6px 0; }
        .item { display: flex; justify-content: space-between; padding: 2px 0; font-size: 11px; }
        .item-name { flex: 1; }
        .total { display: flex; justify-content: space-between; font-weight: bold; font-size: 16px; border-top: 2px dashed #333; padding-top: 8px; margin-top: 8px; }
        .footer { text-align: center; margin-top: 12px; font-size: 9px; color: #999; border-top: 1px dashed #ccc; padding-top: 8px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <div class="header">
        <h1>SOUK.AI</h1>
        <p>Ticket de caisse</p>
      </div>
      <div class="date">${lastReceipt.date.toLocaleString('fr-FR')}</div>
      <div class="sep"></div>
      ${lastReceipt.items.map(c => `
        <div class="item">
          <span class="item-name">${c.product.name_fr || c.product.name_ar}</span>
          <span>${c.qty}x${c.price.toFixed(2)}</span>
          <span style="min-width:60px;text-align:right">${(c.qty * c.price).toFixed(2)}</span>
        </div>
      `).join('')}
      <div class="total">
        <span>TOTAL</span>
        <span>${lastReceipt.total.toFixed(2)} MAD</span>
      </div>
      <div class="footer">Merci de votre visite!<br/>Souk.AI</div>
      </body></html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 300)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" /></div>
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-7rem)]">
      {/* Left: Product Grid */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="mb-4">
          <div className="relative">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher produit ou scanner code-barres..."
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map(p => {
              const inCart = cart.find(c => c.product.id === p.id)
              const stock = p.inventory?.quantity || 0
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className={`relative p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                    inCart ? 'border-violet-500 bg-violet-50' : 'border-gray-100 bg-white hover:border-gray-200'
                  }`}
                >
                  <p className="font-semibold text-sm text-gray-900 truncate">{p.name_fr || p.name_ar}</p>
                  {p.name_ar && p.name_fr && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{p.name_ar}</p>
                  )}
                  <p className="text-lg font-black text-violet-600 mt-2">{(p.unit_price || 0).toFixed(2)}</p>
                  <p className="text-xs text-gray-400">MAD / {p.unit || 'piece'}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-xs font-medium ${stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      Stock: {stock}
                    </span>
                    {inCart && (
                      <span className="text-xs font-bold text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">
                        x{inCart.qty}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-400">
                <FiSearch className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aucun produit trouve</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-full lg:w-96 flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <FiShoppingCart className="h-4 w-4" /> Panier
          </h2>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-xs text-red-500 hover:text-red-600 font-medium">
              Vider
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto divide-y">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
              <FiShoppingCart className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Panier vide</p>
              <p className="text-xs mt-1">Cliquez sur un produit pour l'ajouter</p>
            </div>
          ) : cart.map(item => (
            <div key={item.product.id} className="px-4 py-3">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{item.product.name_fr || item.product.name_ar}</p>
                </div>
                <button onClick={() => removeFromCart(item.product.id)} className="p-1 hover:bg-red-50 rounded-lg ml-2">
                  <FiTrash2 className="h-3.5 w-3.5 text-red-400" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateQty(item.product.id, -1)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    <FiMinus className="h-3 w-3" />
                  </button>
                  <span className="w-8 text-center text-sm font-bold">{item.qty}</span>
                  <button
                    onClick={() => updateQty(item.product.id, 1)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    <FiPlus className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={item.price}
                    onChange={e => updatePrice(item.product.id, e.target.value)}
                    className="w-20 text-right text-sm border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-violet-500"
                    step="0.01"
                    min="0"
                  />
                  <span className="text-xs text-gray-400">MAD</span>
                </div>
              </div>
              <p className="text-right text-sm font-bold text-violet-600 mt-1">
                {(item.qty * item.price).toFixed(2)} MAD
              </p>
            </div>
          ))}
        </div>

        {/* Cart footer */}
        <div className="border-t p-4 space-y-3 bg-gray-50">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Articles: {cart.reduce((s, c) => s + c.qty, 0)}</span>
            <span className="text-xl font-black text-gray-900">{cartTotal.toFixed(2)} MAD</span>
          </div>
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || processing}
            className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold rounded-xl hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 transition-all text-sm"
          >
            {processing ? 'Traitement...' : 'Encaisser'}
          </button>
        </div>
      </div>

      {/* Receipt Modal */}
      {showReceipt && lastReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowReceipt(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <button onClick={() => setShowReceipt(false)} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-xl">
              <FiX className="h-5 w-5 text-gray-500" />
            </button>
            <div className="text-center mb-4">
              <div className="w-14 h-14 mx-auto mb-3 bg-green-100 rounded-full flex items-center justify-center">
                <FiShoppingCart className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Vente enregistree!</h3>
              <p className="text-sm text-gray-500 mt-1">{lastReceipt.date.toLocaleString('fr-FR')}</p>
            </div>
            <div className="space-y-2 mb-4">
              {lastReceipt.items.map((c, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-600">{c.qty}x {c.product.name_fr || c.product.name_ar}</span>
                  <span className="font-medium">{(c.qty * c.price).toFixed(2)} MAD</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span className="text-violet-600">{lastReceipt.total.toFixed(2)} MAD</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowReceipt(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-medium transition-colors"
              >
                Fermer
              </button>
              <button
                onClick={printReceipt}
                className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <FiPrinter className="h-4 w-4" /> Imprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
