import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { FiCheckCircle, FiXCircle, FiClock } from 'react-icons/fi'
import axios from 'axios'
import { useTranslation } from 'react-i18next'
import { formatMoney } from '../utils/money'

const API_URL = import.meta.env.VITE_API_URL || '/api/v1'

export default function PayInvoice() {
  const { t, i18n } = useTranslation()
  const { token } = useParams()
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [cardNumber, setCardNumber] = useState('')
  const [pin, setPin] = useState('')

  useEffect(() => {
    axios.get(`${API_URL}/invoices/pay/${token}`)
      .then(res => setInvoice(res.data))
      .catch(() => setError(t('pay.notFound')))
      .finally(() => setLoading(false))
  }, [token])

  const handlePay = async () => {
    setPaying(true)
    setError('')
    try {
      // Public link: Souk card only; cash and bank card are confirmed by the logged-in merchant (S7).
      if (!cardNumber) { setError(t('pay.cardRequired')); setPaying(false); return }
      const payload = { method: 'NFC_SOUKCARD', card_number: cardNumber }
      if (pin) payload.pin = pin
      await axios.post(`${API_URL}/invoices/pay/${token}`, payload)
      setSuccess(true)
    } catch (e) {
      setError(e.response?.data?.detail || t('common.error'))
    }
    setPaying(false)
  }

  const fmt = (v) => formatMoney(v, invoice?.currency || 'MAD', i18n.language)

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-pulse text-gray-500">{t('common.loading')}</div>
    </div>
  )

  if (error && !invoice) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
        <FiXCircle size={48} className="mx-auto text-red-400 mb-4" />
        <p className="text-lg font-medium text-gray-700">{error}</p>
      </div>
    </div>
  )

  if (success) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
        <FiCheckCircle size={64} className="mx-auto text-green-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('pay.confirmed')}</h2>
        <p className="text-gray-500">{t('pay.paidAmount', { amount: fmt(invoice.total_amount) })}</p>
      </div>
    </div>
  )

  if (invoice.status !== 'PENDING') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
        <FiClock size={48} className="mx-auto text-gray-500 mb-4" />
        <p className="text-lg font-medium text-gray-700">
          {invoice.status === 'PAID' ? 'Cette facture a deja ete payee' : 'Cette facture a expire ou a ete annulee'}
        </p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-600 to-blue-600 p-6 text-white text-center">
          <h1 className="text-xl font-bold">Souk.AI</h1>
          <p className="text-brand-100 text-sm mt-1">{t('pay.secure')}</p>
        </div>

        {/* Invoice Details */}
        <div className="p-6 space-y-4">
          {invoice.customer_name && (
            <p className="text-gray-600 text-sm">{t('payments.customer')}: <span className="font-medium text-gray-900">{invoice.customer_name}</span></p>
          )}

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500 mb-2">{t('pos.articles')}</p>
            {invoice.items?.map((item, i) => (
              <div key={i} className="flex justify-between text-sm py-1">
                <span>{item.product_name} x{item.quantity}</span>
                <span className="font-medium">{fmt(item.quantity * item.unit_price)}</span>
              </div>
            ))}
            <div className="border-t mt-2 pt-2 flex justify-between font-bold">
              <span>{t('common.total')}</span>
              <span className="text-brand-700 text-lg">{fmt(invoice.total_amount)}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-3">
            <p className="font-medium text-sm text-gray-700">{t('pos.soukCard')}</p>
            <div className="space-y-2">
              <input value={cardNumber} onChange={e => setCardNumber(e.target.value)} placeholder={t('payments.cardNumber')} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder={t('pos.enterPin')} className="w-full px-3 py-2 border rounded-lg text-sm" maxLength={6} />
            </div>

          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}

          <button onClick={handlePay} disabled={paying}
            className="w-full py-3 bg-gradient-to-r from-brand-600 to-blue-600 text-white rounded-lg font-medium hover:from-brand-700 hover:to-blue-700 disabled:opacity-50">
            {paying ? t('pos.processing') : t('pay.payAmount', { amount: fmt(invoice.total_amount) })}
          </button>
        </div>
      </div>
    </div>
  )
}
