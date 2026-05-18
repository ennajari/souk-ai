import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { FiSearch, FiPlus, FiMinus, FiTrash2, FiPrinter, FiX, FiShoppingCart, FiCamera, FiUser, FiChevronUp, FiLink, FiCreditCard, FiDollarSign, FiSmartphone, FiShield, FiCheckCircle, FiLoader, FiBookOpen } from 'react-icons/fi'
import { productsAPI, transactionsAPI, customersAPI } from '../api/client'
import client from '../api/client'
import BarcodeScanner from '../components/BarcodeScanner'
import SoukCardVisual from '../components/SoukCardVisual'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

const PAYMENT_METHODS = [
  { id: 'CASH', label: 'Especes', labelAr: 'نقدي', icon: FiDollarSign, color: 'green' },
  { id: 'NFC_SOUKCARD', label: 'Carte Souk.AI', labelAr: 'بطاقة سوق', icon: FiSmartphone, color: 'purple' },
  { id: 'NFC_BANK', label: 'Carte bancaire', labelAr: 'بطاقة بنكية', icon: FiCreditCard, color: 'blue' },
]

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
  const [linkModal, setLinkModal] = useState(null)
  const [linkSearch, setLinkSearch] = useState('')
  const [linking, setLinking] = useState(false)
  const [qtyPopup, setQtyPopup] = useState(null)
  const searchRef = useRef()
  const linkSearchRef = useRef()

  // Payment state
  const [showPayment, setShowPayment] = useState(false)
  const [payMethod, setPayMethod] = useState('CASH')
  const [cardNumber, setCardNumber] = useState('')
  const [cardPin, setCardPin] = useState('')
  const [payStep, setPayStep] = useState('select') // select | nfc_waiting | card_found | pin_entry | processing | success | error
  const [payError, setPayError] = useState('')
  const [nfcReading, setNfcReading] = useState(false)
  const [detectedCard, setDetectedCard] = useState(null) // { card_number, holder_name, balance, status }
  const pinRef = useRef()
  const nfcAbort = useRef(null)

  useEffect(() => {
    Promise.all([
      productsAPI.list().catch(() => ({ data: [] })),
      client.get('/customers/').catch(() => ({ data: [] })),
    ]).then(([prodRes, custRes]) => {
      setProducts(prodRes.data)
      setCustomers(custRes.data)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    searchRef.current?.focus()
  }, [loading])

  useEffect(() => {
    let buffer = ''
    let timeout = null
    const handleKeyPress = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'Enter' && buffer.length >= 4) {
        const code = buffer.trim()
        const product = products.find(p => p.barcode === code)
        if (product) {
          addToCart(product, true)
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
    return () => { window.removeEventListener('keypress', handleKeyPress); clearTimeout(timeout) }
  }, [products])

  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 120)
    return () => clearTimeout(t)
  }, [search])

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase()
    if (!q) return products
    return products.filter(p =>
      (p.name_fr || '').toLowerCase().includes(q) ||
      (p.name_ar || '').toLowerCase().includes(q) ||
      (p.barcode || '').includes(q)
    )
  }, [products, debouncedSearch])

  const addToCart = (product, fromScan = false) => {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id)
      if (existing) {
        if (fromScan) {
          setTimeout(() => setQtyPopup({ productId: product.id, name: product.name_fr || product.name_ar, qty: existing.qty + 1 }), 0)
          return prev
        }
        return prev.map(c => c.product.id === product.id ? { ...c, qty: c.qty + 1 } : c)
      }
      return [...prev, { product, qty: 1, price: product.unit_price || 0 }]
    })
  }

  const handleBarcodeScan = (code) => {
    const product = products.find(p => p.barcode === code)
    if (product) {
      addToCart(product, true)
      toast.success(`${product.name_fr || product.name_ar} ✓`)
      return { name: product.name_fr || product.name_ar }
    } else {
      setShowScanner(false)
      setLinkSearch('')
      setLinkModal({ barcode: code })
      setTimeout(() => linkSearchRef.current?.focus(), 100)
      return null
    }
  }

  const linkSuggestions = useMemo(() => {
    if (!linkSearch.trim()) return products.slice(0, 8)
    const q = linkSearch.toLowerCase()
    return products
      .filter(p => (p.name_fr || '').toLowerCase().includes(q) || (p.name_ar || '').toLowerCase().includes(q) || (p.barcode || '').includes(q))
      .slice(0, 8)
  }, [linkSearch, products])

  const handleLinkBarcode = async (product) => {
    setLinking(true)
    try {
      await productsAPI.update(product.id, { barcode: linkModal.barcode })
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, barcode: linkModal.barcode } : p))
      toast.success(`Code-barres lié à "${product.name_fr || product.name_ar}"`)
      addToCart({ ...product, barcode: linkModal.barcode })
      setLinkModal(null)
    } catch { toast.error('Erreur lors de la liaison du code-barres') }
    finally { setLinking(false) }
  }

  const updateQty = (productId, delta) => {
    setCart(prev => prev.map(c => {
      if (c.product.id !== productId) return c
      const newQty = c.qty + delta
      return newQty > 0 ? { ...c, qty: newQty } : c
    }))
  }

  const setQtyDirect = (productId, qty) => {
    const n = parseInt(qty, 10)
    if (isNaN(n) || n < 0) return
    if (n === 0) { removeFromCart(productId); return }
    setCart(prev => prev.map(c => c.product.id === productId ? { ...c, qty: n } : c))
  }

  const updatePrice = (productId, price) => {
    setCart(prev => prev.map(c => c.product.id === productId ? { ...c, price: parseFloat(price) || 0 } : c))
  }

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(c => c.product.id !== productId))
  }

  const cartTotal = cart.reduce((s, c) => s + c.qty * c.price, 0)
  const cartCount = cart.reduce((s, c) => s + c.qty, 0)

  // Open payment modal
  const openPayment = () => {
    if (cart.length === 0) return toast.error(t('pos.emptyCart'))
    setPayMethod('CASH')
    setCardNumber('')
    setCardPin('')
    setPayStep('select')
    setPayError('')
    setNfcReading(false)
    setDetectedCard(null)
    setShowPayment(true)
  }

  const hasNfc = typeof window !== 'undefined' && 'NDEFReader' in window

  // Start NFC scan — detect card, look up info, then ask PIN
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
          // Look up card by NFC UID
          const res = await client.get(`/souk-cards/nfc/${serialNumber}`)
          if (res.data) {
            setDetectedCard({ ...res.data, nfc_uid: serialNumber })
            setPayStep('card_found')
          }
        } catch {
          // NFC UID not registered — might be bank card
          if (payMethod === 'NFC_BANK') {
            executePayment('NFC_BANK', null, null, serialNumber)
          } else {
            setPayError('Carte non reconnue. Verifiez que la carte est enregistree.')
            setPayStep('select')
          }
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

  // Execute payment (final step after PIN)
  const executePayment = async (method, cardNum, pin, nfcUid) => {
    setPayStep('processing')
    setPayError('')
    try {
      const items = cart.map(c => ({
        product_name: c.product.name_fr || c.product.name_ar,
        quantity: c.qty,
        unit_price: c.price,
      }))
      const invoiceRes = await client.post('/invoices/', {
        customer_name: detectedCard?.holder_name || customers.find(c => c.id === selectedCustomer)?.name || null,
        items,
        expires_minutes: 5,
      })

      const payPayload = { method }
      if (cardNum) payPayload.card_number = cardNum
      if (pin) payPayload.pin = pin
      if (nfcUid) payPayload.nfc_uid = nfcUid

      await client.post(`/invoices/pay/${invoiceRes.data.token}`, payPayload)

      await transactionsAPI.createBulk(
        cart.map(c => ({ product_id: c.product.id, quantity: c.qty, unit_price: c.price, type: 'SALE', source: 'WEB' })),
        selectedCustomer || null,
      )

      setPayStep('success')
      setTimeout(() => finalizeSale(method === 'NFC_SOUKCARD' ? 'Carte Souk.AI' : method === 'NFC_BANK' ? 'Carte bancaire NFC' : 'Especes'), 1500)
    } catch (err) {
      setPayStep('error')
      setPayError(err.response?.data?.detail || 'Erreur de paiement')
    }
  }

  // Cash checkout — single batch call, works both inside modal and standalone
  const handleCashCheckout = async () => {
    if (processing) return
    setProcessing(true)
    setPayStep('processing')
    try {
      await transactionsAPI.createBulk(
        cart.map(c => ({ product_id: c.product.id, quantity: c.qty, unit_price: c.price, type: 'SALE', source: 'WEB' })),
        selectedCustomer || null,
      )
      finalizeSale('Especes')
    } catch (err) {
      setPayStep('error')
      setPayError(err.response?.data?.detail || t('common.error'))
      toast.error(err.response?.data?.detail || t('common.error'))
    } finally {
      setProcessing(false)
    }
  }

  // Credit checkout — record sale + add credit entry to customer's carnet
  const handleCreditCheckout = async () => {
    if (processing) return
    if (!selectedCustomer) { toast.error('Selectionnez un client pour le credit'); return }
    if (cart.length === 0) { toast.error(t('pos.emptyCart')); return }
    setProcessing(true)
    try {
      await transactionsAPI.createBulk(
        cart.map(c => ({ product_id: c.product.id, quantity: c.qty, unit_price: c.price, type: 'SALE', source: 'WEB' })),
        selectedCustomer,
      )
      const itemNames = cart.map(c => `${c.qty}x ${c.product.name_fr || c.product.name_ar}`).join(', ')
      await customersAPI.addEntry(selectedCustomer, {
        type: 'CREDIT',
        amount: cartTotal,
        description: `POS: ${itemNames}`,
      })
      finalizeSale('Credit')
    } catch (err) {
      toast.error(err.response?.data?.detail || t('common.error'))
    } finally {
      setProcessing(false)
    }
  }

  const finalizeSale = (methodLabel) => {
    setLastReceipt({
      items: [...cart], total: cartTotal, date: new Date(),
      customerName: detectedCard?.holder_name || customers.find(c => c.id === selectedCustomer)?.name,
      paymentMethod: methodLabel,
    })
    setShowPayment(false)
    setShowReceipt(true)
    setCart([])
    setSelectedCustomer('')
    setMobileCartOpen(false)
    setDetectedCard(null)
    toast.success(`${t('pos.saleRegistered')} ${cartTotal.toFixed(2)} MAD`)
  }

  // Confirm PIN and pay
  const confirmPinAndPay = () => {
    if (!cardPin || cardPin.length < 4) { setPayError('Code PIN requis (4-6 chiffres)'); return }
    setPayError('')
    executePayment('NFC_SOUKCARD', detectedCard?.card_number, cardPin, detectedCard?.nfc_uid)
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
  .payment { text-align: center; font-size: 10px; margin-top: 6px; padding: 4px; background: #f5f5f5; }
  .footer { text-align: center; margin-top: 12px; font-size: 9px; color: #999; border-top: 1px dashed #ccc; padding-top: 8px; }
  @media print { body { padding: 0; } @page { margin: 0; size: 80mm auto; } }
</style></head><body>
<div class="header">
  <h1>SOUK.AI</h1>
  <p>Ticket de caisse</p>
</div>
<div class="date">${receipt.date.toLocaleString(isRtl ? 'ar-MA' : 'fr-FR')}</div>
${receipt.customerName ? `<div style="text-align:center;font-size:10px;margin-bottom:6px;">Client: ${receipt.customerName}</div>` : ''}
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
<div class="payment">Paye par: ${receipt.paymentMethod || 'Especes'}</div>
<div class="footer">Merci / شكرا<br/>Souk.AI — Paiement securise</div>
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
                <button onClick={() => updateQty(item.product.id, -1)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors active:scale-95">
                  <FiMinus className="h-4 w-4" />
                </button>
                <input type="number" min="1" value={item.qty} onChange={e => setQtyDirect(item.product.id, e.target.value)} onFocus={e => e.target.select()}
                  className="w-12 text-center text-sm font-bold border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-violet-400 bg-white py-1" />
                <button onClick={() => updateQty(item.product.id, 1)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors active:scale-95">
                  <FiPlus className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-1">
                <input type="number" value={item.price} onChange={e => updatePrice(item.product.id, e.target.value)}
                  className="w-20 text-right text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-violet-500" step="0.01" min="0" />
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
          <select value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 bg-white">
            <option value="">{t('pos.noClient')}</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ''}</option>)}
          </select>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">{t('pos.articles')}: {cartCount}</span>
          <span className="text-xl font-black text-gray-900">{cartTotal.toFixed(2)} MAD</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { if (cart.length === 0) return toast.error(t('pos.emptyCart')); handleCashCheckout() }} disabled={cart.length === 0 || processing}
            className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 transition-all text-sm active:scale-[0.98] flex items-center justify-center gap-2">
            <FiDollarSign className="h-4 w-4" /> Cash
          </button>
          <button onClick={handleCreditCheckout} disabled={cart.length === 0 || processing || !selectedCustomer}
            className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 transition-all text-sm active:scale-[0.98] flex items-center justify-center gap-2"
            title={!selectedCustomer ? 'Selectionnez un client' : ''}>
            <FiBookOpen className="h-4 w-4" /> Credit
          </button>
          <button onClick={openPayment} disabled={cart.length === 0}
            className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold rounded-xl hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 transition-all text-sm active:scale-[0.98] flex items-center justify-center gap-2">
            <FiCreditCard className="h-4 w-4" /> NFC
          </button>
        </div>
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
            <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder={t('pos.searchProduct')}
              className={`w-full py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'}`} />
          </div>
          <button onClick={() => setShowScanner(true)}
            className="px-4 py-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors flex items-center gap-2 active:scale-95" title={t('pos.scanner')}>
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
                <button key={p.id} onClick={() => addToCart(p)}
                  className={`relative p-3 sm:p-4 rounded-xl border-2 text-left transition-all hover:shadow-md active:scale-[0.97] ${
                    inCart ? 'border-violet-500 bg-violet-50' : 'border-gray-100 bg-white hover:border-gray-200'
                  } ${isRtl ? 'text-right' : ''}`}>
                  {p.barcode && <p className="text-[10px] text-gray-400 font-mono mb-1 truncate">{p.barcode}</p>}
                  <p className="font-semibold text-sm text-gray-900 truncate">{isRtl ? (p.name_ar || p.name_fr) : (p.name_fr || p.name_ar)}</p>
                  {p.name_ar && p.name_fr && <p className="text-xs text-gray-400 truncate mt-0.5">{isRtl ? p.name_fr : p.name_ar}</p>}
                  <p className="text-lg font-black text-violet-600 mt-2">{(p.unit_price || 0).toFixed(2)}</p>
                  <p className="text-xs text-gray-400">MAD / {p.unit || 'piece'}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-xs font-medium ${stock > 0 ? 'text-green-600' : 'text-red-500'}`}>{t('pos.stock')}: {stock}</span>
                    {inCart && <span className="text-xs font-bold text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">x{inCart.qty}</span>}
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

      {/* Desktop Cart Sidebar */}
      <div className="hidden lg:flex w-96 flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <CartContent isMobile={false} />
      </div>

      {/* Mobile: Floating cart button */}
      {!mobileCartOpen && (
        <button onClick={() => setMobileCartOpen(true)}
          className="lg:hidden fixed bottom-4 right-4 left-4 z-30 flex items-center justify-between bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-2xl px-5 py-4 shadow-2xl active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-3">
            <div className="relative">
              <FiShoppingCart className="h-6 w-6" />
              {cartCount > 0 && <span className="absolute -top-2 -right-2 min-w-[20px] h-5 bg-white text-violet-600 text-xs rounded-full flex items-center justify-center font-bold px-1">{cartCount}</span>}
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
            <div className="flex justify-center pt-2 pb-1"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
            <CartContent isMobile={true} />
          </div>
        </div>
      )}

      {/* ═══ PAYMENT TERMINAL MODAL ═══ */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => ['select'].includes(payStep) && setShowPayment(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

            {/* Terminal Header */}
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FiShield className="h-5 w-5" />
                  <h3 className="font-bold text-lg">Terminal Souk.AI</h3>
                </div>
                {['select', 'nfc_waiting', 'card_found'].includes(payStep) && (
                  <button onClick={() => { stopNfcScan(); setShowPayment(false) }} className="p-1 hover:bg-white/20 rounded-lg"><FiX className="h-5 w-5" /></button>
                )}
              </div>
              <p className="text-white text-2xl font-black mt-1">{cartTotal.toFixed(2)} MAD</p>
              <p className="text-violet-200 text-xs">{cartCount} article(s)</p>
            </div>

            {/* ── Step: Select method ── */}
            {payStep === 'select' && (
              <div className="p-5 space-y-3">
                {PAYMENT_METHODS.map(m => {
                  const isActive = payMethod === m.id
                  const colors = { green: ['border-green-500','bg-green-50','bg-green-100','text-green-600'], purple: ['border-purple-500','bg-purple-50','bg-purple-100','text-purple-600'], blue: ['border-blue-500','bg-blue-50','bg-blue-100','text-blue-600'] }
                  const c = colors[m.color]
                  return (
                    <button key={m.id} onClick={() => { setPayMethod(m.id); setPayError('') }}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${isActive ? `${c[0]} ${c[1]}` : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isActive ? c[2] : 'bg-gray-100'}`}>
                        <m.icon className={`h-6 w-6 ${isActive ? c[3] : 'text-gray-400'}`} />
                      </div>
                      <div className="text-left flex-1">
                        <p className={`font-semibold ${isActive ? 'text-gray-900' : 'text-gray-600'}`}>{m.label}</p>
                        <p className="text-xs text-gray-400">{m.labelAr}</p>
                      </div>
                      {isActive && <FiCheckCircle className={`h-5 w-5 ${c[3]}`} />}
                    </button>
                  )
                })}

                {payError && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{payError}</div>}

                <button onClick={() => {
                  if (payMethod === 'CASH') handleCashCheckout()
                  else startNfcScan()
                }}
                  className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all text-base active:scale-[0.98] flex items-center justify-center gap-3">
                  {payMethod === 'CASH' && <><FiDollarSign className="h-5 w-5" /> Confirmer {cartTotal.toFixed(2)} MAD</>}
                  {payMethod === 'NFC_SOUKCARD' && <><FiSmartphone className="h-5 w-5" /> Scanner la carte Souk.AI</>}
                  {payMethod === 'NFC_BANK' && <><FiCreditCard className="h-5 w-5" /> Scanner la carte bancaire</>}
                </button>
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
                    {payMethod === 'NFC_SOUKCARD'
                      ? <FiSmartphone className="h-12 w-12 text-purple-600" />
                      : <FiCreditCard className="h-12 w-12 text-blue-600" />
                    }
                  </div>
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">
                    {payMethod === 'NFC_SOUKCARD' ? 'Approchez la carte Souk.AI' : 'Approchez la carte bancaire'}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Placez la carte sur le dos du telephone</p>
                  <p className="text-xs text-gray-400 mt-3">{cartTotal.toFixed(2)} MAD</p>
                </div>
                <button onClick={() => { stopNfcScan(); setPayStep('select') }}
                  className="px-8 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200">Annuler</button>
              </div>
            )}

            {/* ── Step: Card Found — show info + PIN ── */}
            {payStep === 'card_found' && detectedCard && (
              <div className="p-6 space-y-4">
                {/* Card visual */}
                <SoukCardVisual
                  cardNumber={detectedCard.card_number}
                  holderName={detectedCard.holder_name}
                  balance={detectedCard.balance}
                  cardType={detectedCard.card_type || 'CLIENT'}
                />

                {/* Balance check */}
                {detectedCard.balance < cartTotal && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex items-center gap-2">
                    <FiX className="h-4 w-4 flex-shrink-0" />
                    Solde insuffisant ({detectedCard.balance.toFixed(2)} MAD &lt; {cartTotal.toFixed(2)} MAD)
                  </div>
                )}

                {detectedCard.balance >= cartTotal && (
                  <>
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
                        <FiShield className="h-4 w-4 text-green-500" /> Entrez le code PIN du client
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
                <div className="w-24 h-24 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                  <FiCheckCircle className="h-12 w-12 text-green-500" />
                </div>
                <p className="text-2xl font-black text-gray-900">Paiement reussi!</p>
                <p className="text-xl text-green-600 font-black mt-2">{cartTotal.toFixed(2)} MAD</p>
                {detectedCard && <p className="text-sm text-gray-500 mt-1">Merci {detectedCard.holder_name}</p>}
              </div>
            )}

            {/* ── Step: Error ── */}
            {payStep === 'error' && (
              <div className="p-8 text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                  <FiX className="h-10 w-10 text-red-500" />
                </div>
                <p className="text-lg font-bold text-gray-900">Paiement refuse</p>
                <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{payError}</p>
                <button onClick={() => { setPayStep('select'); setCardPin(''); setDetectedCard(null) }}
                  className="px-8 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200">
                  Reessayer
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showScanner && <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setShowScanner(false)} continuous={true} />}

      {/* Link Barcode Modal */}
      {linkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setLinkModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <button onClick={() => setLinkModal(null)} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-xl"><FiX className="h-5 w-5 text-gray-500" /></button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0"><FiLink className="h-5 w-5 text-violet-600" /></div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Code-barres non reconnu</h3>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{linkModal.barcode}</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-3">Associez ce code-barres à un produit existant :</p>
            <div className="relative mb-3">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input ref={linkSearchRef} value={linkSearch} onChange={e => setLinkSearch(e.target.value)} placeholder="Rechercher produit par nom..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div className="max-h-56 overflow-y-auto divide-y divide-gray-50 rounded-xl border border-gray-100">
              {linkSuggestions.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-6">Aucun produit trouvé</p>
              ) : linkSuggestions.map(p => (
                <button key={p.id} onClick={() => handleLinkBarcode(p)} disabled={linking}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-violet-50 transition-colors text-left disabled:opacity-50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 truncate">{p.name_fr || p.name_ar}</p>
                    {p.name_ar && p.name_fr && p.name_ar !== p.name_fr && <p className="text-xs text-gray-400 truncate">{p.name_ar}</p>}
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <p className="text-sm font-bold text-violet-600">{(p.unit_price || 0).toFixed(2)} MAD</p>
                    {p.barcode && <p className="text-[10px] text-gray-400 font-mono">{p.barcode}</p>}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">Le code-barres sera enregistré définitivement sur ce produit</p>
          </div>
        </div>
      )}

      {/* Quick Qty Popup */}
      {qtyPopup && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setQtyPopup(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-5" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-bold text-gray-900 truncate mb-1">{qtyPopup.name}</p>
            <p className="text-xs text-gray-400 mb-4">Combien d'unités ?</p>
            <input type="number" min="1" autoFocus value={qtyPopup.qty} onChange={e => setQtyPopup(p => ({ ...p, qty: e.target.value }))} onFocus={e => e.target.select()}
              className="w-full text-center text-3xl font-black border-2 border-violet-300 rounded-xl py-3 outline-none focus:border-violet-500" />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setQtyPopup(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Annuler</button>
              <button onClick={() => { setQtyDirect(qtyPopup.productId, qtyPopup.qty); setQtyPopup(null) }}
                className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold">OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && lastReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowReceipt(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <button onClick={() => setShowReceipt(false)} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-xl"><FiX className="h-5 w-5 text-gray-500" /></button>
            <div className="text-center mb-4">
              <div className="w-14 h-14 mx-auto mb-3 bg-green-100 rounded-full flex items-center justify-center">
                <FiShoppingCart className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">{t('pos.saleRegistered')}</h3>
              <p className="text-sm text-gray-500 mt-1">{lastReceipt.date.toLocaleString(isRtl ? 'ar-MA' : 'fr-FR')}</p>
              {lastReceipt.paymentMethod && (
                <span className="inline-block mt-2 text-xs font-medium bg-violet-100 text-violet-700 px-3 py-1 rounded-full">
                  {lastReceipt.paymentMethod}
                </span>
              )}
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
              <button onClick={() => setShowReceipt(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-medium transition-colors">{t('common.close')}</button>
              <button onClick={directPrint}
                className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                <FiPrinter className="h-4 w-4" /> {t('pos.directPrint')}
              </button>
              <button onClick={printReceipt}
                className="py-2.5 px-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                <FiPrinter className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
