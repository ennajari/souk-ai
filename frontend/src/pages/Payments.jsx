import { useState, useEffect } from 'react'
import { FiCreditCard, FiDollarSign, FiSettings, FiCopy, FiFileText, FiPlusCircle, FiX, FiSmartphone } from 'react-icons/fi'
import client from '../api/client'
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

export default function Payments() {
  const [tab, setTab] = useState('invoices')
  const [payments, setPayments] = useState([])
  const [invoices, setInvoices] = useState([])
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showNewInvoice, setShowNewInvoice] = useState(false)
  const [showNewCard, setShowNewCard] = useState(false)
  const [configForm, setConfigForm] = useState({ cmi_merchant_id: '', cmi_api_key: '', cashplus_agent_id: '', cashplus_api_key: '', preferred_method: 'CASH' })

  // Invoice form
  const [invoiceForm, setInvoiceForm] = useState({
    customer_name: '', customer_phone: '', notes: '',
    items: [{ product_name: '', quantity: 1, unit_price: 0 }],
  })

  // Card form
  const [cardForm, setCardForm] = useState({ holder_name: '', holder_phone: '', pin: '' })
  const [cardLookup, setCardLookup] = useState('')
  const [cardInfo, setCardInfo] = useState(null)
  const [topupAmount, setTopupAmount] = useState('')

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

  const createInvoice = async () => {
    try {
      const items = invoiceForm.items.filter(i => i.product_name && i.unit_price > 0)
      if (!items.length) return toast.error('Ajoutez au moins un article')
      const payload = { ...invoiceForm, items }
      await client.post('/invoices/', payload)
      toast.success('Facture creee!')
      setShowNewInvoice(false)
      setInvoiceForm({ customer_name: '', customer_phone: '', notes: '', items: [{ product_name: '', quantity: 1, unit_price: 0 }] })
      fetchData()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erreur') }
  }

  const cancelInvoice = async (id) => {
    try {
      await client.delete(`/invoices/${id}`)
      toast.success('Facture annulee')
      fetchData()
    } catch { toast.error('Erreur') }
  }

  const copyLink = (token) => {
    const url = `${window.location.origin}/pay/${token}`
    navigator.clipboard.writeText(url)
    toast.success('Lien de paiement copie!')
  }

  const registerCard = async () => {
    try {
      if (!cardForm.holder_name || !cardForm.holder_phone || !cardForm.pin) return toast.error('Remplissez tous les champs')
      if (!/^\d{4,6}$/.test(cardForm.pin)) return toast.error('PIN: 4-6 chiffres')
      const res = await client.post('/souk-cards/register', cardForm)
      toast.success(`Carte creee: ${res.data.card_number}`)
      setShowNewCard(false)
      setCardForm({ holder_name: '', holder_phone: '', pin: '' })
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

  const addItem = () => setInvoiceForm(f => ({ ...f, items: [...f.items, { product_name: '', quantity: 1, unit_price: 0 }] }))
  const removeItem = (idx) => setInvoiceForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
  const updateItem = (idx, field, value) => setInvoiceForm(f => ({
    ...f, items: f.items.map((item, i) => i === idx ? { ...item, [field]: value } : item),
  }))

  const totalCompleted = payments.filter(p => p.status === 'COMPLETED').reduce((s, p) => s + p.amount, 0)
  const totalPending = invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + i.total_amount, 0)
  const invoiceTotal = invoiceForm.items.reduce((s, i) => s + (i.quantity * i.unit_price), 0)

  const tabs = [
    ['invoices', 'Factures', FiFileText],
    ['history', 'Historique', FiDollarSign],
    ['cards', 'Carte Souk.AI', FiCreditCard],
    ['config', 'Configuration', FiSettings],
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Paiements</h1>
        <p className="text-gray-500 text-sm">Factures, NFC, Carte Souk.AI et plus</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Total paye</p>
          <p className="text-2xl font-bold text-green-600">{totalCompleted.toFixed(2)} MAD</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Factures en attente</p>
          <p className="text-2xl font-bold text-yellow-600">{totalPending.toFixed(2)} MAD</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Factures</p>
          <p className="text-2xl font-bold text-purple-600">{invoices.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Transactions</p>
          <p className="text-2xl font-bold text-gray-900">{payments.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit flex-wrap">
        {tabs.map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === key ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {/* ─── Invoices Tab ─── */}
      {tab === 'invoices' && (
        <div className="space-y-4">
          <button onClick={() => setShowNewInvoice(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            <FiPlusCircle /> Nouvelle facture
          </button>

          {/* New Invoice Modal */}
          {showNewInvoice && (
            <div className="bg-white rounded-xl border p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-lg">Creer une facture</h3>
                <button onClick={() => setShowNewInvoice(false)}><FiX size={20} /></button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input value={invoiceForm.customer_name} onChange={e => setInvoiceForm({ ...invoiceForm, customer_name: e.target.value })} placeholder="Nom du client" className="px-3 py-2 border rounded-lg" />
                <input value={invoiceForm.customer_phone} onChange={e => setInvoiceForm({ ...invoiceForm, customer_phone: e.target.value })} placeholder="Tel client (212...)" className="px-3 py-2 border rounded-lg" />
              </div>

              <div className="space-y-2">
                <p className="font-medium text-sm text-gray-600">Articles</p>
                {invoiceForm.items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input value={item.product_name} onChange={e => updateItem(idx, 'product_name', e.target.value)} placeholder="Produit" className="flex-1 px-3 py-2 border rounded-lg" />
                    <input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} placeholder="Qte" className="w-20 px-3 py-2 border rounded-lg" min="1" />
                    <input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} placeholder="Prix" className="w-24 px-3 py-2 border rounded-lg" min="0" step="0.01" />
                    <span className="text-sm text-gray-500 w-20 text-right">{(item.quantity * item.unit_price).toFixed(2)}</span>
                    {invoiceForm.items.length > 1 && <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><FiX /></button>}
                  </div>
                ))}
                <button onClick={addItem} className="text-sm text-purple-600 hover:text-purple-800">+ Ajouter un article</button>
              </div>

              <div className="flex justify-between items-center border-t pt-4">
                <span className="text-lg font-bold">Total: {invoiceTotal.toFixed(2)} MAD</span>
                <button onClick={createInvoice} className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">Creer la facture</button>
              </div>
            </div>
          )}

          {/* Invoice List */}
          <div className="bg-white rounded-xl border overflow-x-auto">
            {loading ? <div className="p-8 text-center text-gray-400">Chargement...</div> : invoices.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <FiFileText size={48} className="mx-auto mb-3 opacity-30" />
                <p>Aucune facture</p>
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
                    <th className="text-left px-4 py-3">Actions</th>
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
                      <td className="px-4 py-3 flex gap-2">
                        {inv.status === 'PENDING' && (
                          <>
                            <button onClick={() => copyLink(inv.token)} className="text-purple-600 hover:text-purple-800 text-sm flex items-center gap-1" title="Copier le lien de paiement"><FiCopy size={14} /> Lien</button>
                            <button onClick={() => cancelInvoice(inv.id)} className="text-red-500 hover:text-red-700 text-sm">Annuler</button>
                          </>
                        )}
                      </td>
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
        <div className="bg-white rounded-xl border overflow-x-auto">
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
                  <th className="text-left px-4 py-3">Ref</th>
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
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {p.external_ref && <span className="cursor-pointer hover:text-purple-600" onClick={() => { navigator.clipboard.writeText(p.external_ref); toast.success('Copie!') }}>{p.external_ref} <FiCopy size={12} className="inline" /></span>}
                    </td>
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
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Register new card */}
            <div className="bg-white rounded-xl border p-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2"><FiSmartphone /> Nouvelle Carte Souk.AI</h3>
              <input value={cardForm.holder_name} onChange={e => setCardForm({ ...cardForm, holder_name: e.target.value })} placeholder="Nom du titulaire" className="w-full px-3 py-2 border rounded-lg" />
              <input value={cardForm.holder_phone} onChange={e => setCardForm({ ...cardForm, holder_phone: e.target.value })} placeholder="Telephone (212XXXXXXXXX)" className="w-full px-3 py-2 border rounded-lg" />
              <input type="password" value={cardForm.pin} onChange={e => setCardForm({ ...cardForm, pin: e.target.value })} placeholder="Code PIN (4-6 chiffres)" className="w-full px-3 py-2 border rounded-lg" maxLength={6} />
              <button onClick={registerCard} className="w-full py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700">Creer la carte</button>
            </div>

            {/* Lookup / Topup */}
            <div className="bg-white rounded-xl border p-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2"><FiCreditCard /> Consulter / Recharger</h3>
              <div className="flex gap-2">
                <input value={cardLookup} onChange={e => setCardLookup(e.target.value)} placeholder="Numero de carte (9212...)" className="flex-1 px-3 py-2 border rounded-lg" />
                <button onClick={lookupCard} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium">Chercher</button>
              </div>

              {cardInfo && (
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Titulaire</span>
                    <span className="font-medium">{cardInfo.holder_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Solde</span>
                    <span className="text-xl font-bold text-green-600">{cardInfo.balance.toFixed(2)} MAD</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Statut</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${cardInfo.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{cardInfo.status === 'ACTIVE' ? 'Active' : 'Suspendue'}</span>
                  </div>
                  <div className="border-t pt-3 flex gap-2">
                    <input type="number" value={topupAmount} onChange={e => setTopupAmount(e.target.value)} placeholder="Montant MAD" className="flex-1 px-3 py-2 border rounded-lg" min="1" max="5000" />
                    <button onClick={doTopup} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">Recharger</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* How it works */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border p-6">
            <h3 className="font-semibold text-purple-800 mb-3">Comment fonctionne la Carte Souk.AI ?</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="font-bold text-purple-700 mb-1">1. Creer</p>
                <p className="text-gray-600">Le client obtient sa carte chez un partenaire Souk.AI avec un code PIN</p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="font-bold text-purple-700 mb-1">2. Recharger</p>
                <p className="text-gray-600">Rechargement via app bancaire, CashPlus, ou en boutique</p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="font-bold text-purple-700 mb-1">3. Payer</p>
                <p className="text-gray-600">Le client paye via NFC ou en donnant son numero de carte</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Config Tab ─── */}
      {tab === 'config' && (
        <div className="bg-white rounded-xl border p-6 space-y-6 max-w-lg">
          <div>
            <h3 className="font-semibold mb-1">Methode preferee</h3>
            <select value={configForm.preferred_method} onChange={e => setConfigForm({ ...configForm, preferred_method: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
              {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <FiCreditCard /> CMI (Carte bancaire)
              {config?.has_cmi && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Configure</span>}
            </h3>
            <div className="space-y-3">
              <input value={configForm.cmi_merchant_id} onChange={e => setConfigForm({ ...configForm, cmi_merchant_id: e.target.value })} placeholder="CMI Merchant ID" className="w-full px-3 py-2 border rounded-lg" />
              <input type="password" value={configForm.cmi_api_key} onChange={e => setConfigForm({ ...configForm, cmi_api_key: e.target.value })} placeholder="CMI API Key" className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <FiDollarSign /> CashPlus
              {config?.has_cashplus && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Configure</span>}
            </h3>
            <div className="space-y-3">
              <input value={configForm.cashplus_agent_id} onChange={e => setConfigForm({ ...configForm, cashplus_agent_id: e.target.value })} placeholder="CashPlus Agent ID" className="w-full px-3 py-2 border rounded-lg" />
              <input type="password" value={configForm.cashplus_api_key} onChange={e => setConfigForm({ ...configForm, cashplus_api_key: e.target.value })} placeholder="CashPlus API Key" className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>

          <button onClick={saveConfig} className="w-full py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700">
            Sauvegarder la configuration
          </button>
        </div>
      )}
    </div>
  )
}
