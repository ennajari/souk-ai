import { useState, useEffect, useRef, useMemo } from 'react'
import { FiSearch, FiPlus, FiMinus, FiTrash2, FiPrinter, FiX, FiShoppingCart, FiCamera, FiUser, FiChevronUp, FiLink } from 'react-icons/fi'
import { productsAPI, transactionsAPI } from '../api/client'
import client from '../api/client'
import BarcodeScanner from '../components/BarcodeScanner'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

export default function POS() {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [lastReceipt, setLastReceipt] = useState(null)
  const [showScanner, setShowScanner] = useState(false)
  const [customers, setCustomers] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [mobileCartOpen, setMobileCartOpen] = useState(false)
  const [linkModal, setLinkModal] = useState(null) // { barcode: string }
  const [linkSearch, setLinkSearch] = useState('')
  const [linking, setLinking] = useState(false)
  const searchRef = useRef()
  const linkSearchRef = useRef()

  useEffect(() => {
    productsAPI.list()
      .then(r => setProducts(r.data))
      .catch(() => toast.error(t('common.error')))
      .finally(() => setLoading(false))
    client.get('/customers/').then(r => setCustomers(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    searchRef.current?.focus()
  }, [loading])

  // Listen for barcode scanner keyboard input (external USB scanners)
  useEffect(() => {
    let buffer = ''
    let timeout = null

    const handleKeyPress = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (e.key === 'Enter' && buffer.length >= 4) {
        const code = buffer.trim()
        const product = products.find(p => p.barcode === code)
        if (product) {
          addToCart(product)
          toast.success(`${product.name_fr || product.name_ar} ✓`)
        } else {
          setLinkSearch('')
          setLinkModal({ barcode: code })
          setTimeout(() => linkSearchRef.current?.focus(), 100)
        }
        buffer = ''
        return
      }

      if (e.key.length === 1) {
        buffer += e.key
        clearTimeout(timeout)
        timeout = setTimeout(() => { buffer = '' }, 100)
      }
    }

    window.addEventListener('keypress', handleKeyPress)
    return () => {
      window.removeEventListener('keypress', handleKeyPress)
      clearTimeout(timeout)
    }
  }, [products])

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

  const handleBarcodeScan = (code) => {
    setShowScanner(false)
    const product = products.find(p => p.barcode === code)
    if (product) {
      addToCart(product)
      toast.success(`${product.name_fr || product.name_ar} ✓`)
    } else {
      // No product found → offer to link this barcode to an existing product
      setLinkSearch('')
      setLinkModal({ barcode: code })
      setTimeout(() => linkSearchRef.current?.focus(), 100)
    }
  }

  const linkSuggestions = useMemo(() => {
    if (!linkSearch.trim()) return products.slice(0, 8)
    const q = linkSearch.toLowerCase()
    return products
      .filter(p =>
        (p.name_fr || '').toLowerCase().includes(q) ||
        (p.name_ar || '').toLowerCase().includes(q) ||
        (p.barcode || '').includes(q)
      )
      .slice(0, 8)
  }, [linkSearch, products])

  const handleLinkBarcode = async (product) => {
    setLinking(true)
    try {
      await productsAPI.update(product.id, { barcode: linkModal.barcode })
      // Update local products state
      setProducts(prev => prev.map(p =>
        p.id === product.id ? { ...p, barcode: linkModal.barcode } : p
      ))
      toast.success(`Code-barres lié à "${product.name_fr || product.name_ar}"`)
      addToCart({ ...product, barcode: linkModal.barcode })
      setLinkModal(null)
    } catch {
      toast.error('Erreur lors de la liaison du code-barres')
    } finally {
      setLinking(false)
    }
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
  const cartCount = cart.reduce((s, c) => s + c.qty, 0)

  const handleCheckout = async () => {
    if (cart.length === 0) return toast.error(t('pos.emptyCart'))
    setProcessing(true)
    try {
      for (const item of cart) {
        await transactionsAPI.create({
          product_id: item.product.id,
          customer_id: selectedCustomer || null,
          quantity: item.qty,
          unit_price: item.price,
          type: 'SALE',
          source: 'WEB',
        })
      }
      setLastReceipt({ items: [...cart], total: cartTotal, date: new Date(), customerName: customers.find(c => c.id === selectedCustomer)?.name })
      setShowReceipt(true)
      setCart([])
      setSelectedCustomer('')
      setMobileCartOpen(false)
      toast.success(`${t('pos.saleRegistered')} ${cartTotal.toFixed(2)} MAD`)
    } catch (err) {
      toast.error(err.response?.data?.detail || t('common.error'))
    } finally {
      setProcessing(false)
    }
  }

  const generateReceiptHTML = (receipt) => `<!DOCTYPE html>
<html dir="${isRtl ? 'rtl' : 'ltr'}"><head><title>Ticket</title>
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
  @media print { body { padding: 0; } @page { margin: 0; size: 80mm auto; } }
</style></head><body>
<div class="header">
  <h1>SOUK.AI</h1>
  <p>Ticket de caisse</p>
</div>
<div class="date">${receipt.date.toLocaleString(isRtl ? 'ar-MA' : 'fr-FR')}</div>
<div class="sep"></div>
${receipt.items.map(c => `
  <div class="item">
    <span class="item-name">${isRtl ? (c.product.name_ar || c.product.name_fr) : (c.product.name_fr || c.product.name_ar)}</span>
    <span>${c.qty}x${c.price.toFixed(2)}</span>
    <span style="min-width:60px;text-align:${isRtl ? 'left' : 'right'}">${(c.qty * c.price).toFixed(2)}</span>
  </div>
`).join('')}
<div class="total">
  <span>${t('common.total')}</span>
  <span>${receipt.total.toFixed(2)} MAD</span>
</div>
<div class="footer">Merci / شكرا<br/>Souk.AI</div>
</body></html>`

  const printReceipt = () => {
    if (!lastReceipt) return
    const html = generateReceiptHTML(lastReceipt)
    const win = window.open('', '_blank', 'width=350,height=500')
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 300)
  }

  const directPrint = () => {
    if (!lastReceipt) return
    const html = generateReceiptHTML(lastReceipt)
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.top = '-10000px'
    iframe.style.left = '-10000px'
    iframe.style.width = '80mm'
    document.body.appendChild(iframe)
    iframe.contentDocument.write(html)
    iframe.contentDocument.close()
    setTimeout(() => {
      iframe.contentWindow.print()
      setTimeout(() => document.body.removeChild(iframe), 1000)
    }, 300)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" /></div>
  }

  // Cart panel (shared between desktop sidebar and mobile bottom sheet)
  const CartContent = ({ isMobile }) => (
    <>
      <div className={`px-5 py-4 border-b bg-gray-50 flex items-center justify-between ${isMobile ? 'rounded-t-2xl' : ''}`}>
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <FiShoppingCart className="h-4 w-4" /> {t('pos.cart')}
          {cartCount > 0 && <span className="text-xs bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full">{cartCount}</span>}
        </h2>
        <div className="flex items-center gap-2">
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-xs text-red-500 hover:text-red-600 font-medium">
              {t('pos.clearCart')}
            </button>
          )}
          {isMobile && (
            <button onClick={() => setMobileCartOpen(false)} className="p-1 hover:bg-gray-200 rounded-lg">
              <FiX className="h-5 w-5 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
            <FiShoppingCart className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">{t('pos.emptyCart')}</p>
            <p className="text-xs mt-1">{t('pos.clickProduct')}</p>
          </div>
        ) : cart.map(item => (
          <div key={item.product.id} className="px-4 py-3">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {isRtl ? (item.product.name_ar || item.product.name_fr) : (item.product.name_fr || item.product.name_ar)}
                </p>
              </div>
              <button onClick={() => removeFromCart(item.product.id)} className={`p-1.5 hover:bg-red-50 rounded-lg ${isRtl ? 'mr-2' : 'ml-2'}`}>
                <FiTrash2 className="h-3.5 w-3.5 text-red-400" />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => updateQty(item.product.id, -1)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors active:scale-95"
                >
                  <FiMinus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center text-sm font-bold">{item.qty}</span>
                <button
                  onClick={() => updateQty(item.product.id, 1)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors active:scale-95"
                >
                  <FiPlus className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={item.price}
                  onChange={e => updatePrice(item.product.id, e.target.value)}
                  className="w-20 text-right text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-violet-500"
                  step="0.01"
                  min="0"
                />
                <span className="text-xs text-gray-400">MAD</span>
              </div>
            </div>
            <p className={`text-sm font-bold text-violet-600 mt-1 ${isRtl ? 'text-left' : 'text-right'}`}>
              {(item.qty * item.price).toFixed(2)} MAD
            </p>
          </div>
        ))}
      </div>

      {/* Cart footer */}
      <div className="border-t p-4 space-y-3 bg-gray-50">
        <div className="flex items-center gap-2">
          <FiUser className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <select
            value={selectedCustomer}
            onChange={e => setSelectedCustomer(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 bg-white"
          >
            <option value="">{t('pos.noClient')}</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ''}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">{t('pos.articles')}: {cartCount}</span>
          <span className="text-xl font-black text-gray-900">{cartTotal.toFixed(2)} MAD</span>
        </div>
        <button
          onClick={handleCheckout}
          disabled={cart.length === 0 || processing}
          className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold rounded-xl hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 transition-all text-sm active:scale-[0.98]"
        >
          {processing ? t('pos.processing') : t('pos.checkout')}
        </button>
      </div>
    </>
  )

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-[calc(100vh-7rem)]">
      {/* Product Grid */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="mb-3 flex gap-2">
          <div className="relative flex-1">
            <FiSearch className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 ${isRtl ? 'right-3.5' : 'left-3.5'}`} />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('pos.searchProduct')}
              className={`w-full py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'}`}
            />
          </div>
          <button
            onClick={() => setShowScanner(true)}
            className="px-4 py-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors flex items-center gap-2 active:scale-95"
            title={t('pos.scanner')}
          >
            <FiCamera className="h-5 w-5" />
            <span className="hidden sm:inline text-sm font-medium">{t('pos.scanner')}</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
            {filtered.map(p => {
              const inCart = cart.find(c => c.product.id === p.id)
              const stock = p.stock_quantity ?? 0
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className={`relative p-3 sm:p-4 rounded-xl border-2 text-left transition-all hover:shadow-md active:scale-[0.97] ${
                    inCart ? 'border-violet-500 bg-violet-50' : 'border-gray-100 bg-white hover:border-gray-200'
                  } ${isRtl ? 'text-right' : ''}`}
                >
                  {p.barcode && (
                    <p className="text-[10px] text-gray-400 font-mono mb-1 truncate">{p.barcode}</p>
                  )}
                  <p className="font-semibold text-sm text-gray-900 truncate">
                    {isRtl ? (p.name_ar || p.name_fr) : (p.name_fr || p.name_ar)}
                  </p>
                  {p.name_ar && p.name_fr && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{isRtl ? p.name_fr : p.name_ar}</p>
                  )}
                  <p className="text-lg font-black text-violet-600 mt-2">{(p.unit_price || 0).toFixed(2)}</p>
                  <p className="text-xs text-gray-400">MAD / {p.unit || 'piece'}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-xs font-medium ${stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {t('pos.stock')}: {stock}
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
                <p className="text-sm">{t('pos.noProduct')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Cart Sidebar (hidden on mobile) */}
      <div className="hidden lg:flex w-96 flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <CartContent isMobile={false} />
      </div>

      {/* Mobile: Floating cart button */}
      {!mobileCartOpen && (
        <button
          onClick={() => setMobileCartOpen(true)}
          className="lg:hidden fixed bottom-4 right-4 left-4 z-30 flex items-center justify-between bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-2xl px-5 py-4 shadow-2xl active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <FiShoppingCart className="h-6 w-6" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[20px] h-5 bg-white text-violet-600 text-xs rounded-full flex items-center justify-center font-bold px-1">
                  {cartCount}
                </span>
              )}
            </div>
            <span className="font-bold text-sm">{t('pos.cart')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-black">{cartTotal.toFixed(2)} MAD</span>
            <FiChevronUp className="h-5 w-5" />
          </div>
        </button>
      )}

      {/* Mobile: Bottom Sheet Cart */}
      {mobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileCartOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl flex flex-col shadow-2xl animate-slide-up" style={{ maxHeight: '85vh' }}>
            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <CartContent isMobile={true} />
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Link Barcode Modal */}
      {linkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setLinkModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <button onClick={() => setLinkModal(null)} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-xl">
              <FiX className="h-5 w-5 text-gray-500" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <FiLink className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Code-barres non reconnu</h3>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{linkModal.barcode}</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-3">Associez ce code-barres à un produit existant :</p>
            <div className="relative mb-3">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={linkSearchRef}
                value={linkSearch}
                onChange={e => setLinkSearch(e.target.value)}
                placeholder="Rechercher produit par nom..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div className="max-h-56 overflow-y-auto divide-y divide-gray-50 rounded-xl border border-gray-100">
              {linkSuggestions.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-6">Aucun produit trouvé</p>
              ) : linkSuggestions.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleLinkBarcode(p)}
                  disabled={linking}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-violet-50 transition-colors text-left disabled:opacity-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 truncate">{p.name_fr || p.name_ar}</p>
                    {p.name_ar && p.name_fr && p.name_ar !== p.name_fr && (
                      <p className="text-xs text-gray-400 truncate">{p.name_ar}</p>
                    )}
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <p className="text-sm font-bold text-violet-600">{(p.unit_price || 0).toFixed(2)} MAD</p>
                    {p.barcode && <p className="text-[10px] text-gray-400 font-mono">{p.barcode}</p>}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">
              Le code-barres sera enregistré définitivement sur ce produit
            </p>
          </div>
        </div>
      )}

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
              <h3 className="text-lg font-bold text-gray-900">{t('pos.saleRegistered')}</h3>
              <p className="text-sm text-gray-500 mt-1">{lastReceipt.date.toLocaleString(isRtl ? 'ar-MA' : 'fr-FR')}</p>
            </div>
            <div className="space-y-2 mb-4">
              {lastReceipt.items.map((c, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-600">{c.qty}x {isRtl ? (c.product.name_ar || c.product.name_fr) : (c.product.name_fr || c.product.name_ar)}</span>
                  <span className="font-medium">{(c.qty * c.price).toFixed(2)} MAD</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>{t('common.total')}</span>
                <span className="text-violet-600">{lastReceipt.total.toFixed(2)} MAD</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowReceipt(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-medium transition-colors"
              >
                {t('common.close')}
              </button>
              <button
                onClick={directPrint}
                className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <FiPrinter className="h-4 w-4" /> {t('pos.directPrint')}
              </button>
              <button
                onClick={printReceipt}
                className="py-2.5 px-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <FiPrinter className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
