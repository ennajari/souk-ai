import { useState, useEffect, useRef } from 'react'
import { FiCreditCard, FiDollarSign, FiSettings, FiFileText, FiPlusCircle, FiX, FiSmartphone, FiShield, FiCheckCircle, FiWifi } from 'react-icons/fi'
import client from '../api/client'
import SoukCardVisual from '../components/SoukCardVisual'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { useMoney } from '../utils/money'
import { Link } from 'react-router-dom'

const statusColor = {
  PENDING: 'bg-yellow-100 text-yellow-700', PROCESSING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700', PAID: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700', REFUNDED: 'bg-orange-100 text-orange-700',
  CANCELLED: 'bg-gray-100 text-gray-600', EXPIRED: 'bg-gray-100 text-gray-500',
}


export default function Payments() {
  const { t, i18n } = useTranslation()
  const money = useMoney()
  const [tab, setTab] = useState('encaissement')
  const [payments, setPayments] = useState([])
  const [invoices, setInvoices] = useState([])
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [configForm, setConfigForm] = useState({ cmi_merchant_id: '', cmi_api_key: '', cashplus_agent_id: '', cashplus_api_key: '', preferred_method: 'CASH' })

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
    } catch { toast.error(t('common.error')) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  /* ═══ CARD ACTIVATION ═══ */
  const startNfcActivation = async () => {
    if (!hasNfc) { toast.error(t('pos.noNfc')); return }
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
        toast.success(t('payments.nfcDetected'))
      })
    } catch (err) {
      setActivatingNfc(false)
      if (err.name !== 'AbortError') toast.error(t('pos.nfcError'))
    }
  }

  const stopNfcActivation = () => {
    if (nfcActivateAbort.current) { nfcActivateAbort.current.abort(); nfcActivateAbort.current = null }
    setActivatingNfc(false)
  }

  const registerCard = async () => {
    try {
      if (!cardForm.holder_name || !cardForm.holder_phone || !cardForm.pin) return toast.error(t('payments.fillAll'))
      if (!/^\d{4,6}$/.test(cardForm.pin)) return toast.error(t('pos.pinRequired'))
      const payload = {
        holder_name: cardForm.holder_name,
        holder_phone: cardForm.holder_phone,
        pin: cardForm.pin,
        card_type: cardForm.card_type,
      }
      if (cardForm.nfc_uid) payload.nfc_uid = cardForm.nfc_uid
      if (cardForm.card_number) payload.card_number = cardForm.card_number
      const res = await client.post('/souk-cards/register', payload)
      toast.success(t('payments.cardCreated', { number: res.data.card_number }))
      setShowNewCard(false)
      setCardForm({ holder_name: '', holder_phone: '', pin: '', card_type: 'CLIENT', nfc_uid: '', card_number: '' })
    } catch (e) { toast.error(e.response?.data?.detail || 'Erreur') }
  }

  const lookupCard = async () => {
    try {
      const res = await client.get(`/souk-cards/${cardLookup}`)
      setCardInfo(res.data)
    } catch { toast.error(t('payments.cardNotFound')); setCardInfo(null) }
  }

  const doTopup = async () => {
    try {
      if (!cardLookup || !topupAmount) return
      await client.post('/souk-cards/topup', { card_number: cardLookup, amount: parseFloat(topupAmount) })
      toast.success(t('payments.toppedUp'))
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
      toast.success(t('payments.configSaved'))
      fetchData()
    } catch { toast.error(t('common.error')) }
  }

  const totalCompleted = payments.filter(p => p.status === 'COMPLETED').reduce((s, p) => s + p.amount, 0)
  const totalPending = invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + i.total_amount, 0)

  const tabs = [
    ['encaissement', t('payments.invoices'), FiDollarSign],
    ['history', t('payments.history'), FiFileText],
    ['cards', t('pos.soukCard'), FiCreditCard],
    ['config', t('payments.config'), FiSettings],
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('nav.payments')}</h1>
        <p className="text-gray-500 text-sm">{t('payments.subtitle')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm text-gray-500">{t('payments.totalCollected')}</p>
          <p className="text-2xl font-black text-green-600">{money(totalCompleted)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm text-gray-500">{t('suppliersPage.status.PENDING')}</p>
          <p className="text-2xl font-black text-yellow-600">{money(totalPending)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm text-gray-500">{t('payments.invoices')}</p>
          <p className="text-2xl font-black text-brand-600">{invoices.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm text-gray-500">{t('payments.transactions')}</p>
          <p className="text-2xl font-black text-gray-900">{payments.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {tabs.map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === key ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {/* ─── Encaissement Tab ─── */}
      {tab === 'encaissement' && (
        <div className="space-y-4">
          {/* Selling happens at the till (atomic, idempotent, moves stock); this was a third, slower copy of it */}
          <Link to="/pos" className="inline-flex items-center gap-2 px-5 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold transition-colors">
            <FiPlusCircle className="h-5 w-5" aria-hidden="true" /> {t('payments.goToTill')}
          </Link>

          {/* Recent invoices */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
            {loading ? <div className="p-8 text-center text-gray-500">{t('common.loading')}</div> : invoices.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <FiDollarSign size={48} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">{t('payments.noInvoices')}</p>
                <p className="text-sm mt-1">{t('payments.noInvoicesHint')}</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 text-gray-600 text-sm">
                  <tr>
                    <th className="text-left px-4 py-3">{t('common.date')}</th>
                    <th className="text-left px-4 py-3">{t('payments.customer')}</th>
                    <th className="text-left px-4 py-3">{t('pos.articles')}</th>
                    <th className="text-left px-4 py-3">{t('common.amount')}</th>
                    <th className="text-left px-4 py-3">{t('common.status')}</th>
                    <th className="text-left px-4 py-3">{t('payments.payment')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{new Date(inv.created_at).toLocaleDateString(i18n.language)}</td>
                      <td className="px-4 py-3 text-sm">{inv.customer_name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{inv.items?.length || 0} article(s)</td>
                      <td className="px-4 py-3 font-medium">{money(inv.total_amount)}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[inv.status] || 'bg-gray-100'}`}>{t(`payments.statuses.${inv.status}`, { defaultValue: inv.status })}</span></td>
                      <td className="px-4 py-3 text-sm text-gray-500">{inv.payment_method ? t(`payments.methods.${inv.payment_method}`, { defaultValue: inv.payment_method }) : '-'}</td>
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
          {loading ? <div className="p-8 text-center text-gray-500">{t('common.loading')}</div> : payments.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <FiCreditCard size={48} className="mx-auto mb-3 opacity-30" />
              <p>{t('payments.noPayments')}</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 text-gray-600 text-sm">
                <tr>
                  <th className="text-left px-4 py-3">{t('common.date')}</th>
                  <th className="text-left px-4 py-3">{t('payments.method')}</th>
                  <th className="text-left px-4 py-3">{t('common.amount')}</th>
                  <th className="text-left px-4 py-3">{t('common.status')}</th>
                  <th className="text-left px-4 py-3">{t('common.description')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{new Date(p.created_at).toLocaleDateString(i18n.language)}</td>
                    <td className="px-4 py-3 text-sm">{t(`payments.methods.${p.method}`, { defaultValue: p.method })}</td>
                    <td className="px-4 py-3 font-medium">{money(p.amount)}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[p.status] || 'bg-gray-100'}`}>{t(`payments.statuses.${p.status}`, { defaultValue: p.status })}</span></td>
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
              <h3 className="font-bold text-gray-900 flex items-center gap-2"><FiSmartphone className="text-brand-500" /> {t('payments.activateCard')}</h3>

              {/* Card type selector */}
              <div className="flex gap-2">
                {[{ id: 'CLIENT', label: t('payments.cardClient'), color: 'violet' }, { id: 'SUPPLIER', label: t('payments.cardSupplier'), color: 'blue' }].map(ct => (
                  <button key={ct.id} onClick={() => setCardForm(f => ({ ...f, card_type: ct.id }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${cardForm.card_type === ct.id
                      ? ct.color === 'violet' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    {ct.label}
                  </button>
                ))}
              </div>

              {/* Preview */}
              <SoukCardVisual
                cardNumber={cardForm.card_number || (cardForm.card_type === 'SUPPLIER' ? '9213000000000000' : '9212000000000000')}
                holderName={cardForm.holder_name || t('payments.holderName')}
                balance={0}
                cardType={cardForm.card_type}
                compact
              />

              {/* Activation method */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">{t('payments.activationMethod')}</p>
                <div className="flex gap-2">
                  <button onClick={() => setCardActivateMethod('manual')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${cardActivateMethod === 'manual' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500'}`}>
                    {t('payments.byNumber')}
                  </button>
                  <button onClick={() => { setCardActivateMethod('nfc'); if (!activatingNfc) startNfcActivation() }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-1 ${cardActivateMethod === 'nfc' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500'}`}>
                    <FiWifi className="h-3 w-3 rotate-90" /> {t('payments.scanNfc')}
                  </button>
                </div>
              </div>

              {cardActivateMethod === 'manual' ? (
                <input value={cardForm.card_number} onChange={e => setCardForm({ ...cardForm, card_number: e.target.value })}
                  placeholder={t('payments.cardNumberOptional')} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
              ) : (
                <div className="text-center py-3">
                  {activatingNfc ? (
                    <div className="space-y-2">
                      <div className="w-12 h-12 mx-auto border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
                      <p className="text-sm text-gray-600">{t('payments.tapCard')}</p>
                      <button onClick={stopNfcActivation} className="text-xs text-gray-500 hover:text-gray-700">{t('common.cancel')}</button>
                    </div>
                  ) : cardForm.nfc_uid ? (
                    <div className="flex items-center gap-2 justify-center text-green-600">
                      <FiCheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">NFC detecte: {cardForm.nfc_uid.slice(0, 12)}...</span>
                    </div>
                  ) : (
                    <button onClick={startNfcActivation} className="text-sm text-brand-600 hover:text-brand-700 font-medium">
                      {t('payments.tapToScan')}
                    </button>
                  )}
                </div>
              )}

              <input value={cardForm.holder_name} onChange={e => setCardForm({ ...cardForm, holder_name: e.target.value })}
                placeholder={t('payments.holderName')} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
              <input value={cardForm.holder_phone} onChange={e => setCardForm({ ...cardForm, holder_phone: e.target.value })}
                placeholder={t('payments.holderPhone')} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
              <input type="password" value={cardForm.pin} onChange={e => setCardForm({ ...cardForm, pin: e.target.value })}
                placeholder={t('pos.pinRequired')} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" maxLength={6} />
              <button onClick={registerCard}
                className="w-full py-3 bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-xl font-semibold hover:from-brand-700 hover:to-brand-800 transition-all">
                {t('payments.activate')}
              </button>
            </div>

            {/* Lookup / Topup */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2"><FiCreditCard className="text-brand-500" /> {t('payments.lookupTopup')}</h3>
              <div className="flex gap-2">
                <input value={cardLookup} onChange={e => setCardLookup(e.target.value)}
                  placeholder={t('payments.cardNumber')} className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
                <button onClick={lookupCard} className="px-4 py-2.5 bg-gray-100 rounded-xl hover:bg-gray-200 text-sm font-medium transition-colors">{t('common.search')}</button>
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
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${(cardInfo.card_type || 'CLIENT') === 'SUPPLIER' ? 'bg-blue-100 text-blue-700' : 'bg-brand-100 text-brand-700'}`}>
                      {(cardInfo.card_type || 'CLIENT') === 'SUPPLIER' ? 'Fournisseur' : 'Client'}
                    </span>
                  </div>
                  <div className="border-t pt-3 flex gap-2">
                    <input type="number" value={topupAmount} onChange={e => setTopupAmount(e.target.value)}
                      placeholder={t('common.amount')} className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm" min="1" max="5000" />
                    <button onClick={doTopup} className="px-5 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 text-sm font-semibold transition-colors">{t('payments.topup')}</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* How it works */}
          <div className="bg-gradient-to-r from-brand-50 to-brand-100 rounded-2xl border border-brand-100 p-6">
            <h3 className="font-bold text-brand-800 mb-3">{t('payments.howItWorks')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
              {[
                { step: '1', title: t('payments.h1'), desc: t('payments.h1d') },
                { step: '2', title: t('payments.h2'), desc: t('payments.h2d') },
                { step: '3', title: t('payments.h3'), desc: t('payments.h3d') },
                { step: '4', title: t('payments.h4'), desc: t('payments.h4d') },
              ].map(s => (
                <div key={s.step} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center text-xs font-bold mb-2">{s.step}</div>
                  <p className="font-bold text-brand-700 text-sm">{s.title}</p>
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
            <h3 className="font-semibold mb-1">{t('payments.preferred')}</h3>
            <select value={configForm.preferred_method} onChange={e => setConfigForm({ ...configForm, preferred_method: e.target.value })} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm">
              {['CASH', 'CMI', 'CASH_PLUS', 'BANK_TRANSFER', 'NFC_BANK', 'NFC_SOUKCARD'].map(k => <option key={k} value={k}>{t(`payments.methods.${k}`)}</option>)}
            </select>
          </div>
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <FiCreditCard className="text-brand-500" /> CMI (Carte bancaire)
              {config?.has_cmi && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{t('payments.configured')}</span>}
            </h3>
            <div className="space-y-3">
              <input value={configForm.cmi_merchant_id} onChange={e => setConfigForm({ ...configForm, cmi_merchant_id: e.target.value })} placeholder="CMI Merchant ID" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
              <input type="password" value={configForm.cmi_api_key} onChange={e => setConfigForm({ ...configForm, cmi_api_key: e.target.value })} placeholder="CMI API Key" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
            </div>
          </div>
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <FiDollarSign className="text-brand-500" /> CashPlus
              {config?.has_cashplus && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{t('payments.configured')}</span>}
            </h3>
            <div className="space-y-3">
              <input value={configForm.cashplus_agent_id} onChange={e => setConfigForm({ ...configForm, cashplus_agent_id: e.target.value })} placeholder="CashPlus Agent ID" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
              <input type="password" value={configForm.cashplus_api_key} onChange={e => setConfigForm({ ...configForm, cashplus_api_key: e.target.value })} placeholder="CashPlus API Key" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
            </div>
          </div>
          <button onClick={saveConfig} className="w-full py-3 bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-xl font-semibold hover:from-brand-700 hover:to-brand-800 transition-all">
            {t('common.save')}
          </button>
        </div>
      )}

    </div>
  )
}
