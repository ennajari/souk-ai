import { useState, useEffect, useRef } from 'react'
import { FiCreditCard, FiDollarSign, FiSettings, FiFileText, FiPlusCircle, FiX, FiSmartphone, FiShield, FiCheckCircle, FiWifi } from 'react-icons/fi'
import client from '../api/client'
import SoukCardVisual from '../components/SoukCardVisual'
import toast from 'react-hot-toast'

const METHOD_LABELS = {
  CMI: 'Carte bancaire (CMI)', CASH_PLUS: 'CashPlus', BANK_TRANSFER: 'Virement bancaire',
  CASH: 'Especes', NFC_BANK: 'NFC Carte bancaire', NFC_SOUKCARD: 'Carte Souk.AI',
}
const STATUS_LABELS = {
  PENDING: 'En attente', PROCESSING: 'En cours', COMPLETED: 'Complete', PAID: 'Paye',
  FAILED: 'Echoue', REFUNDED: 'Rembourse', CANCELLED: 'Annule', EXPIRED: 'Expire',
}
const statusColor = {
  PENDING: 'bg-yellow-100 text-yellow-700', PROCESSING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700', PAID: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700', REFUNDED: 'bg-orange-100 text-orange-700',
  CANCELLED: 'bg-gray-100 text-gray-600', EXPIRED: 'bg-gray-100 text-gray-500',
}

const PAYMENT_METHODS = [
  { id: 'CASH', label: 'Especes', labelAr: 'نقدي', icon: FiDollarSign, color: 'green' },
  { id: 'NFC_SOUKCARD', label: 'Carte Souk.AI', labelAr: 'بطاقة سوق', icon: FiSmartphone, color: 'purple' },
  { id: 'NFC_BANK', label: 'Carte bancaire', labelAr: 'بطاقة بنكية', icon: FiCreditCard, color: 'blue' },
]

export default function Payments() {
  const [tab, setTab] = useState('encaissement')
  const [payments, setPayments] = useState([])
  const [invoices, setInvoices] = useState([])
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [configForm, setConfigForm] = useState({ cmi_merchant_id: '', cmi_api_key: '', cashplus_agent_id: '', cashplus_api_key: '', preferred_method: 'CASH' })

  // Encaissement form
  const [showEncaissement, setShowEncaissement] = useState(false)
  const [encForm, setEncForm] = useState({
    customer_name: '', customer_phone: '',
    items: [{ product_name: '', quantity: 1, unit_price: 0 }],
  })
  const [payMethod, setPayMethod] = useState('CASH')
  const [payStep, setPayStep] = useState('form') // form | nfc_waiting | card_found | processing | success | error
  const [payError, setPayError] = useState('')
  const [nfcReading, setNfcReading] = useState(false)
  const [detectedCard, setDetectedCard] = useState(null)
  const [cardPin, setCardPin] = useState('')
  const nfcAbort = useRef(null)
  const pinRef = useRef()

  // Card management
  const [showNewCard, setShowNewCard] = useState(false)
  const [cardForm, setCardForm] = useState({ holder_name: '', holder_phone: '', pin: '', card_type: 'CLIENT', nfc_uid: '', card_number: '' })
  const [cardActivateMethod, setCardActivateMethod] = useState('manual') // manual | nfc
  const [cardLookup, setCardLookup] = useState('')
  const [cardInfo, setCardInfo] = useState(null)
  const [topupAmount, setTopupAmount] = useState('')
  const [activatingNfc, setActivatingNfc] = useState(false)
  const nfcActivateAbort = useRef(null)

  const hasNfc = typeof window !== 'undefined' && 'NDEFReader' in window

  const fetchData = async () => {
    setLoading(true)
    try {
      const [paymentsRes, configRes, invoicesRes] = await Promise.all([
        client.get('/payments/'),
        client.get('/payments/config/me'),
        client.get('/invoices/'),
      ])
      setPayments(paymentsRes.data)
      setConfig(configRes.data)
      setInvoices(invoicesRes.data)
      setConfigForm(prev => ({ ...prev, preferred_method: configRes.data.preferred_method }))
    } catch { toast.error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  /* ═══ ENCAISSEMENT ═══ */
  const encTotal = encForm.items.reduce((s, i) => s + (i.quantity * i.unit_price), 0)

  const addItem = () => setEncForm(f => ({ ...f, items: [...f.items, { product_name: '', quantity: 1, unit_price: 0 }] }))
  const removeItem = (idx) => setEncForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
  const updateItem = (idx, field, value) => setEncForm(f => ({
    ...f, items: f.items.map((item, i) => i === idx ? { ...item, [field]: value } : item),
  }))

  const openEncaissement = () => {
    setEncForm({ customer_name: '', customer_phone: '', items: [{ product_name: '', quantity: 1, unit_price: 0 }] })
    setPayMethod('CASH')
    setPayStep('form')
    setPayError('')
    setDetectedCard(null)
    setCardPin('')
    setShowEncaissement(true)
  }

  const startNfcScan = async () => {
    if (!hasNfc) { setPayError('NFC non disponible. Utilisez un telephone Android avec NFC.'); return }
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
          if (payMethod === 'NFC_BANK') {
            executePayment('NFC_BANK', null, null, serialNumber)
          } else {
            setPayError('Carte non reconnue.')
            setPayStep('form')
          }
        }
      })
    } catch (err) {
      setNfcReading(false)
      if (err.name !== 'AbortError') { setPayError('Erreur NFC: ' + (err.message || '')); setPayStep('form') }
    }
  }

  const stopNfcScan = () => {
    if (nfcAbort.current) { nfcAbort.current.abort(); nfcAbort.current = null }
    setNfcReading(false)
  }

  const executePayment = async (method, cardNum, pin, nfcUid) => {
    setPayStep('processing')
    setPayError('')
    try {
      const items = encForm.items.filter(i => i.product_name && i.unit_price > 0)
      if (!items.length) throw new Error('Ajoutez au moins un article')

      const invoiceRes = await client.post('/invoices/', {
        customer_name: detectedCard?.holder_name || encForm.customer_name || null,
        customer_phone: encForm.customer_phone || null,
        items,
        expires_minutes: 5,
      })

      const payPayload = { method }
      if (cardNum) payPayload.card_number = cardNum
      if (pin) payPayload.pin = pin
      if (nfcUid) payPayload.nfc_uid = nfcUid

      await client.post(`/invoices/pay/${invoiceRes.data.token}`, payPayload)
      setPayStep('success')
      setTimeout(() => {
        setShowEncaissement(false)
        fetchData()
        toast.success(`Encaissement de ${encTotal.toFixed(2)} MAD reussi!`)
      }, 1500)
    } catch (err) {
      setPayStep('error')
      setPayError(err.response?.data?.detail || err.message || 'Erreur de paiement')
    }
  }

  const handleEncaisser = () => {
    const items = encForm.items.filter(i => i.product_name && i.unit_price > 0)
    if (!items.length) return toast.error('Ajoutez au moins un article')
    if (payMethod === 'CASH') {
      executePayment('CASH')
    } else {
      startNfcScan()
    }
  }

  const confirmPinAndPay = () => {
    if (!cardPin || cardPin.length < 4) { setPayError('Code PIN requis (4-6 chiffres)'); return }
    setPayError('')
    executePayment('NFC_SOUKCARD', detectedCard?.card_number, cardPin, detectedCard?.nfc_uid)
  }

  /* ═══ CARD ACTIVATION ═══ */
  const startNfcActivation = async () => {
    if (!hasNfc) { toast.error('NFC non disponible'); return }
    try {
      setActivatingNfc(true)
      const ctrl = new AbortController()
      nfcActivateAbort.current = ctrl
      const ndef = new NDEFReader()
      await ndef.scan({ signal: ctrl.signal })
      ndef.addEventListener('reading', ({ serialNumber }) => {
        setCardForm(f => ({ ...f, nfc_uid: serialNumber }))
        setActivatingNfc(false)
        ctrl.abort()
        toast.success('Carte NFC detectee!')
      })
    } catch (err) {
      setActivatingNfc(false)
      if (err.name !== 'AbortError') toast.error('Erreur NFC')
    }
  }

  const stopNfcActivation = () => {
    if (nfcActivateAbort.current) { nfcActivateAbort.current.abort(); nfcActivateAbort.current = null }
    setActivatingNfc(false)
  }

  const registerCard = async () => {
    try {
      if (!cardForm.holder_name || !cardForm.holder_phone || !cardForm.pin) return toast.error('Remplissez tous les champs')
      if (!/^\d{4,6}$/.test(cardForm.pin)) return toast.error('PIN: 4-6 chiffres')
      const payload = {
        holder_name: cardForm.holder_name,
        holder_phone: cardForm.holder_phone,
        pin: cardForm.pin,
        card_type: cardForm.card_type,
      }
      if (cardForm.nfc_uid) payload.nfc_uid = cardForm.nfc_uid
      if (cardForm.card_number) payload.card_number = cardForm.card_number
      const res = await client.post('/souk-cards/register', payload)
      toast.success(`Carte ${res.data.card_type === 'SUPPLIER' ? 'fournisseur' : 'client'} creee: ${res.data.card_number}`)
      setShowNewCard(false)
      setCardForm({ holder_name: '', holder_phone: '', pin: '', card_type: 'CLIENT', nfc_uid: '', card_number: '' })
    } catch (e) { toast.error(e.response?.data?.detail || 'Erreur') }
  }

  const lookupCard = async () => {
    try {
      const res = await client.get(`/souk-cards/${cardLookup}`)
      setCardInfo(res.data)
    } catch { toast.error('Carte introuvable'); setCardInfo(null) }
  }

  const doTopup = async () => {
    try {
      if (!cardLookup || !topupAmount) return
      await client.post('/souk-cards/topup', { card_number: cardLookup, amount: parseFloat(topupAmount) })
      toast.success('Recharge effectuee!')
      setTopupAmount('')
      lookupCard()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erreur') }
  }

  /* ═══ CONFIG ═══ */
  const saveConfig = async () => {
    try {
      const data = {}
      if (configForm.cmi_merchant_id) data.cmi_merchant_id = configForm.cmi_merchant_id
      if (configForm.cmi_api_key) data.cmi_api_key = configForm.cmi_api_key
      if (configForm.cashplus_agent_id) data.cashplus_agent_id = configForm.cashplus_agent_id
      if (configForm.cashplus_api_key) data.cashplus_api_key = configForm.cashplus_api_key
      data.preferred_method = configForm.preferred_method
      await client.patch('/payments/config/me', data)
      toast.success('Configuration sauvegardee')
      fetchData()
    } catch { toast.error('Erreur') }
  }

  const totalCompleted = payments.filter(p => p.status === 'COMPLETED').reduce((s, p) => s + p.amount, 0)
  const totalPending = invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + i.total_amount, 0)

  const tabs = [
    ['encaissement', 'Encaissement', FiDollarSign],
    ['history', 'Historique', FiFileText],
    ['cards', 'Carte Souk.AI', FiCreditCard],
    ['config', 'Configuration', FiSettings],
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Paiements</h1>
        <p className="text-gray-500 text-sm">Encaissement, NFC, Carte Souk.AI</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm text-gray-500">Total encaisse</p>
          <p className="text-2xl font-black text-green-600">{totalCompleted.toFixed(2)} MAD</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm text-gray-500">En attente</p>
          <p className="text-2xl font-black text-yellow-600">{totalPending.toFixed(2)} MAD</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm text-gray-500">Factures</p>
          <p className="text-2xl font-black text-purple-600">{invoices.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm text-gray-500">Transactions</p>
          <p className="text-2xl font-black text-gray-900">{payments.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {tabs.map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === key ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {/* ─── Encaissement Tab ─── */}
      {tab === 'encaissement' && (
        <div className="space-y-4">
          <button onClick={openEncaissement} className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:from-violet-700 hover:to-indigo-700 font-semibold shadow-lg shadow-violet-200 transition-all">
            <FiPlusCircle className="h-5 w-5" /> Nouvel encaissement
          </button>

          {/* Recent invoices */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
            {loading ? <div className="p-8 text-center text-gray-400">Chargement...</div> : invoices.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <FiDollarSign size={48} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">Aucun encaissement</p>
                <p className="text-sm mt-1">Commencez par creer un encaissement</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 text-gray-600 text-sm">
                  <tr>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Client</th>
                    <th className="text-left px-4 py-3">Articles</th>
                    <th className="text-left px-4 py-3">Montant</th>
                    <th className="text-left px-4 py-3">Statut</th>
                    <th className="text-left px-4 py-3">Paiement</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{new Date(inv.created_at).toLocaleDateString('fr-FR')}</td>
                      <td className="px-4 py-3 text-sm">{inv.customer_name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{inv.items?.length || 0} article(s)</td>
                      <td className="px-4 py-3 font-medium">{inv.total_amount.toFixed(2)} MAD</td>
                      <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[inv.status] || 'bg-gray-100'}`}>{STATUS_LABELS[inv.status]}</span></td>
                      <td className="px-4 py-3 text-sm text-gray-500">{inv.payment_method ? METHOD_LABELS[inv.payment_method] || inv.payment_method : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ─── History Tab ─── */}
      {tab === 'history' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
          {loading ? <div className="p-8 text-center text-gray-400">Chargement...</div> : payments.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <FiCreditCard size={48} className="mx-auto mb-3 opacity-30" />
              <p>Aucun paiement</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 text-gray-600 text-sm">
                <tr>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Methode</th>
                  <th className="text-left px-4 py-3">Montant</th>
                  <th className="text-left px-4 py-3">Statut</th>
                  <th className="text-left px-4 py-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3 text-sm">{METHOD_LABELS[p.method] || p.method}</td>
                    <td className="px-4 py-3 font-medium">{p.amount.toFixed(2)} MAD</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[p.status] || 'bg-gray-100'}`}>{STATUS_LABELS[p.status]}</span></td>
                    <td className="px-4 py-3 text-sm text-gray-500">{p.description || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ─── Souk Cards Tab ─── */}
      {tab === 'cards' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Activate / Register card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2"><FiSmartphone className="text-violet-500" /> Activer une carte</h3>

              {/* Card type selector */}
              <div className="flex gap-2">
                {[{ id: 'CLIENT', label: 'Client', color: 'violet' }, { id: 'SUPPLIER', label: 'Fournisseur', color: 'blue' }].map(t => (
                  <button key={t.id} onClick={() => setCardForm(f => ({ ...f, card_type: t.id }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${cardForm.card_type === t.id
                      ? t.color === 'violet' ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Preview */}
              <SoukCardVisual
                cardNumber={cardForm.card_number || (cardForm.card_type === 'SUPPLIER' ? '9213000000000000' : '9212000000000000')}
                holderName={cardForm.holder_name || 'Nom du titulaire'}
                balance={0}
                cardType={cardForm.card_type}
                compact
              />

              {/* Activation method */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Methode d'activation</p>
                <div className="flex gap-2">
                  <button onClick={() => setCardActivateMethod('manual')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${cardActivateMethod === 'manual' ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-500'}`}>
                    Numero de carte
                  </button>
                  <button onClick={() => { setCardActivateMethod('nfc'); if (!activatingNfc) startNfcActivation() }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-1 ${cardActivateMethod === 'nfc' ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-500'}`}>
                    <FiWifi className="h-3 w-3 rotate-90" /> Scanner NFC
                  </button>
                </div>
              </div>

              {cardActivateMethod === 'manual' ? (
                <input value={cardForm.card_number} onChange={e => setCardForm({ ...cardForm, card_number: e.target.value })}
                  placeholder="Numero de carte (optionnel)" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
              ) : (
                <div className="text-center py-3">
                  {activatingNfc ? (
                    <div className="space-y-2">
                      <div className="w-12 h-12 mx-auto border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
                      <p className="text-sm text-gray-600">Approchez la carte...</p>
                      <button onClick={stopNfcActivation} className="text-xs text-gray-500 hover:text-gray-700">Annuler</button>
                    </div>
                  ) : cardForm.nfc_uid ? (
                    <div className="flex items-center gap-2 justify-center text-green-600">
                      <FiCheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">NFC detecte: {cardForm.nfc_uid.slice(0, 12)}...</span>
                    </div>
                  ) : (
                    <button onClick={startNfcActivation} className="text-sm text-violet-600 hover:text-violet-700 font-medium">
                      Appuyez pour scanner
                    </button>
                  )}
                </div>
              )}

              <input value={cardForm.holder_name} onChange={e => setCardForm({ ...cardForm, holder_name: e.target.value })}
                placeholder="Nom du titulaire" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
              <input value={cardForm.holder_phone} onChange={e => setCardForm({ ...cardForm, holder_phone: e.target.value })}
                placeholder="Telephone (212XXXXXXXXX)" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
              <input type="password" value={cardForm.pin} onChange={e => setCardForm({ ...cardForm, pin: e.target.value })}
                placeholder="Code PIN (4-6 chiffres)" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" maxLength={6} />
              <button onClick={registerCard}
                className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-violet-700 hover:to-indigo-700 transition-all">
                Activer la carte
              </button>
            </div>

            {/* Lookup / Topup */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2"><FiCreditCard className="text-violet-500" /> Consulter / Recharger</h3>
              <div className="flex gap-2">
                <input value={cardLookup} onChange={e => setCardLookup(e.target.value)}
                  placeholder="Numero de carte (9212... ou 9213...)" className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
                <button onClick={lookupCard} className="px-4 py-2.5 bg-gray-100 rounded-xl hover:bg-gray-200 text-sm font-medium transition-colors">Chercher</button>
              </div>

              {cardInfo && (
                <div className="space-y-3">
                  <SoukCardVisual
                    cardNumber={cardInfo.card_number}
                    holderName={cardInfo.holder_name}
                    balance={cardInfo.balance}
                    cardType={cardInfo.card_type || 'CLIENT'}
                  />
                  <div className="flex items-center justify-between px-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${cardInfo.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {cardInfo.status === 'ACTIVE' ? 'Active' : 'Suspendue'}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${(cardInfo.card_type || 'CLIENT') === 'SUPPLIER' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>
                      {(cardInfo.card_type || 'CLIENT') === 'SUPPLIER' ? 'Fournisseur' : 'Client'}
                    </span>
                  </div>
                  <div className="border-t pt-3 flex gap-2">
                    <input type="number" value={topupAmount} onChange={e => setTopupAmount(e.target.value)}
                      placeholder="Montant MAD" className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm" min="1" max="5000" />
                    <button onClick={doTopup} className="px-5 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 text-sm font-semibold transition-colors">Recharger</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* How it works */}
          <div className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-2xl border border-violet-100 p-6">
            <h3 className="font-bold text-violet-800 mb-3">Comment ca marche ?</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
              {[
                { step: '1', title: 'Recevoir', desc: 'Souk.AI vous fournit des cartes vides' },
                { step: '2', title: 'Activer', desc: 'Configurez la carte avec les infos du client ou fournisseur' },
                { step: '3', title: 'Recharger', desc: 'Le titulaire recharge via CashPlus ou en boutique' },
                { step: '4', title: 'Payer', desc: 'Paiement par NFC ou numero de carte' },
              ].map(s => (
                <div key={s.step} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="w-7 h-7 rounded-lg bg-violet-600 text-white flex items-center justify-center text-xs font-bold mb-2">{s.step}</div>
                  <p className="font-bold text-violet-700 text-sm">{s.title}</p>
                  <p className="text-gray-600 text-xs mt-1">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Config Tab ─── */}
      {tab === 'config' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6 max-w-lg">
          <div>
            <h3 className="font-semibold mb-1">Methode preferee</h3>
            <select value={configForm.preferred_method} onChange={e => setConfigForm({ ...configForm, preferred_method: e.target.value })} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm">
              {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <FiCreditCard className="text-violet-500" /> CMI (Carte bancaire)
              {config?.has_cmi && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Configure</span>}
            </h3>
            <div className="space-y-3">
              <input value={configForm.cmi_merchant_id} onChange={e => setConfigForm({ ...configForm, cmi_merchant_id: e.target.value })} placeholder="CMI Merchant ID" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
              <input type="password" value={configForm.cmi_api_key} onChange={e => setConfigForm({ ...configForm, cmi_api_key: e.target.value })} placeholder="CMI API Key" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
            </div>
          </div>
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <FiDollarSign className="text-violet-500" /> CashPlus
              {config?.has_cashplus && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Configure</span>}
            </h3>
            <div className="space-y-3">
              <input value={configForm.cashplus_agent_id} onChange={e => setConfigForm({ ...configForm, cashplus_agent_id: e.target.value })} placeholder="CashPlus Agent ID" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
              <input type="password" value={configForm.cashplus_api_key} onChange={e => setConfigForm({ ...configForm, cashplus_api_key: e.target.value })} placeholder="CashPlus API Key" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
            </div>
          </div>
          <button onClick={saveConfig} className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-violet-700 hover:to-indigo-700 transition-all">
            Sauvegarder
          </button>
        </div>
      )}

      {/* ═══ ENCAISSEMENT MODAL ═══ */}
      {showEncaissement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => payStep === 'form' && setShowEncaissement(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">

            {/* Header */}
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-4 text-white sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FiShield className="h-5 w-5" />
                  <h3 className="font-bold text-lg">Encaissement</h3>
                </div>
                {payStep === 'form' && (
                  <button onClick={() => setShowEncaissement(false)} className="p-1 hover:bg-white/20 rounded-lg"><FiX className="h-5 w-5" /></button>
                )}
              </div>
              {encTotal > 0 && <p className="text-white text-2xl font-black mt-1">{encTotal.toFixed(2)} MAD</p>}
            </div>

            {/* Step: Form */}
            {payStep === 'form' && (
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <input value={encForm.customer_name} onChange={e => setEncForm({ ...encForm, customer_name: e.target.value })}
                    placeholder="Nom client (optionnel)" className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
                  <input value={encForm.customer_phone} onChange={e => setEncForm({ ...encForm, customer_phone: e.target.value })}
                    placeholder="Tel (optionnel)" className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500">Articles</p>
                  {encForm.items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input value={item.product_name} onChange={e => updateItem(idx, 'product_name', e.target.value)}
                        placeholder="Produit" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                      <input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        placeholder="Qte" className="w-16 px-2 py-2 border border-gray-200 rounded-lg text-sm text-center" min="1" />
                      <input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                        placeholder="Prix" className="w-20 px-2 py-2 border border-gray-200 rounded-lg text-sm text-center" min="0" step="0.01" />
                      {encForm.items.length > 1 && <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><FiX size={16} /></button>}
                    </div>
                  ))}
                  <button onClick={addItem} className="text-sm text-violet-600 hover:text-violet-800 font-medium">+ Article</button>
                </div>

                {encTotal > 0 && (
                  <div className="bg-violet-50 rounded-xl px-4 py-3 flex justify-between items-center border border-violet-100">
                    <span className="text-sm font-medium text-violet-700">Total</span>
                    <span className="text-xl font-black text-violet-800">{encTotal.toFixed(2)} MAD</span>
                  </div>
                )}

                {/* Payment method */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500">Mode de paiement</p>
                  {PAYMENT_METHODS.map(m => {
                    const isActive = payMethod === m.id
                    const colors = { green: ['border-green-500', 'bg-green-50', 'bg-green-100', 'text-green-600'], purple: ['border-purple-500', 'bg-purple-50', 'bg-purple-100', 'text-purple-600'], blue: ['border-blue-500', 'bg-blue-50', 'bg-blue-100', 'text-blue-600'] }
                    const c = colors[m.color]
                    return (
                      <button key={m.id} onClick={() => { setPayMethod(m.id); setPayError('') }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${isActive ? `${c[0]} ${c[1]}` : 'border-gray-200 hover:border-gray-300'}`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? c[2] : 'bg-gray-100'}`}>
                          <m.icon className={`h-5 w-5 ${isActive ? c[3] : 'text-gray-400'}`} />
                        </div>
                        <div className="text-left flex-1">
                          <p className={`font-semibold text-sm ${isActive ? 'text-gray-900' : 'text-gray-600'}`}>{m.label}</p>
                          <p className="text-xs text-gray-400">{m.labelAr}</p>
                        </div>
                        {isActive && <FiCheckCircle className={`h-5 w-5 ${c[3]}`} />}
                      </button>
                    )
                  })}
                </div>

                {payError && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{payError}</div>}

                <button onClick={handleEncaisser} disabled={encTotal <= 0}
                  className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold rounded-xl hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 transition-all text-base flex items-center justify-center gap-2">
                  {payMethod === 'CASH' && <><FiDollarSign className="h-5 w-5" /> Encaisser {encTotal.toFixed(2)} MAD</>}
                  {payMethod === 'NFC_SOUKCARD' && <><FiSmartphone className="h-5 w-5" /> Scanner Carte Souk.AI</>}
                  {payMethod === 'NFC_BANK' && <><FiCreditCard className="h-5 w-5" /> Scanner Carte bancaire</>}
                </button>
              </div>
            )}

            {/* Step: NFC Waiting */}
            {payStep === 'nfc_waiting' && (
              <div className="p-8 text-center space-y-5">
                <div className="relative w-32 h-32 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-purple-200 animate-ping opacity-30" />
                  <div className="absolute inset-3 rounded-full border-4 border-purple-300 animate-ping opacity-20" style={{ animationDelay: '0.5s' }} />
                  <div className="absolute inset-8 rounded-full bg-gradient-to-br from-purple-100 to-violet-100 flex items-center justify-center shadow-inner">
                    {payMethod === 'NFC_SOUKCARD' ? <FiSmartphone className="h-10 w-10 text-purple-600" /> : <FiCreditCard className="h-10 w-10 text-blue-600" />}
                  </div>
                </div>
                <p className="text-lg font-bold text-gray-900">Approchez la carte</p>
                <p className="text-sm text-gray-500">Placez la carte sur le dos du telephone</p>
                <button onClick={() => { stopNfcScan(); setPayStep('form') }}
                  className="px-8 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200">Annuler</button>
              </div>
            )}

            {/* Step: Card Found + PIN */}
            {payStep === 'card_found' && detectedCard && (
              <div className="p-6 space-y-4">
                <SoukCardVisual
                  cardNumber={detectedCard.card_number}
                  holderName={detectedCard.holder_name}
                  balance={detectedCard.balance}
                  cardType={detectedCard.card_type || 'CLIENT'}
                />

                {detectedCard.balance < encTotal ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex items-center gap-2">
                    <FiX className="h-4 w-4 flex-shrink-0" />
                    Solde insuffisant ({detectedCard.balance.toFixed(2)} MAD &lt; {encTotal.toFixed(2)} MAD)
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
                        <FiShield className="h-4 w-4 text-green-500" /> Code PIN du client
                      </p>
                      <div className="flex gap-1 justify-center">
                        {[0, 1, 2, 3, 4, 5].map(i => (
                          <div key={i} className={`w-10 h-12 rounded-lg border-2 flex items-center justify-center text-xl font-black ${i < cardPin.length ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 bg-gray-50 text-gray-300'}`}>
                            {i < cardPin.length ? '•' : ''}
                          </div>
                        ))}
                      </div>
                      <input ref={pinRef} type="tel" value={cardPin} autoFocus
                        onChange={e => { setCardPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setPayError('') }}
                        className="opacity-0 absolute -z-10 w-0 h-0"
                        onKeyDown={e => e.key === 'Enter' && cardPin.length >= 4 && confirmPinAndPay()} />
                      <button onClick={() => pinRef.current?.focus()} className="w-full text-center text-xs text-purple-600 mt-2 py-1">
                        Appuyez pour saisir le PIN
                      </button>
                    </div>
                    {payError && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{payError}</div>}
                    <button onClick={confirmPinAndPay} disabled={cardPin.length < 4}
                      className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-700 disabled:opacity-40 transition-all flex items-center justify-center gap-2">
                      <FiCheckCircle className="h-5 w-5" /> Confirmer {encTotal.toFixed(2)} MAD
                    </button>
                  </>
                )}
                <button onClick={() => { setPayStep('form'); setDetectedCard(null); setCardPin('') }}
                  className="w-full py-2 text-gray-500 text-sm hover:text-gray-700">Annuler</button>
              </div>
            )}

            {/* Step: Processing */}
            {payStep === 'processing' && (
              <div className="p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
                <p className="text-lg font-bold text-gray-900">Traitement...</p>
              </div>
            )}

            {/* Step: Success */}
            {payStep === 'success' && (
              <div className="p-12 text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                  <FiCheckCircle className="h-10 w-10 text-green-500" />
                </div>
                <p className="text-2xl font-black text-gray-900">Paiement reussi!</p>
                <p className="text-xl text-green-600 font-black mt-2">{encTotal.toFixed(2)} MAD</p>
              </div>
            )}

            {/* Step: Error */}
            {payStep === 'error' && (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                  <FiX className="h-8 w-8 text-red-500" />
                </div>
                <p className="text-lg font-bold text-gray-900">Erreur</p>
                <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{payError}</p>
                <button onClick={() => { setPayStep('form'); setCardPin(''); setDetectedCard(null) }}
                  className="px-8 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200">Reessayer</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
