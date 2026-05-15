import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { FiCreditCard, FiSmartphone, FiCheckCircle, FiXCircle, FiClock } from 'react-icons/fi'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api/v1'

export default function PayInvoice() {
  const { token } = useParams()
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [method, setMethod] = useState('NFC_SOUKCARD')
  const [cardNumber, setCardNumber] = useState('')
  const [pin, setPin] = useState('')

  useEffect(() => {
    axios.get(`${API_URL}/invoices/pay/${token}`)
      .then(res => setInvoice(res.data))
      .catch(() => setError('Facture introuvable ou expiree'))
      .finally(() => setLoading(false))
  }, [token])

  const handlePay = async () => {
    setPaying(true)
    setError('')
    try {
      const payload = { method }
      if (method === 'NFC_SOUKCARD') {
        if (!cardNumber) { setError('Numero de carte requis'); setPaying(false); return }
        payload.card_number = cardNumber
        if (pin) payload.pin = pin
      }
      await axios.post(`${API_URL}/invoices/pay/${token}`, payload)
      setSuccess(true)
    } catch (e) {
      setError(e.response?.data?.detail || 'Erreur de paiement')
    }
    setPaying(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-pulse text-gray-400">Chargement...</div>
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Paiement confirme!</h2>
        <p className="text-gray-500">{invoice.total_amount.toFixed(2)} MAD paye avec succes</p>
      </div>
    </div>
  )

  if (invoice.status !== 'PENDING') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
        <FiClock size={48} className="mx-auto text-gray-400 mb-4" />
        <p className="text-lg font-medium text-gray-700">
          {invoice.status === 'PAID' ? 'Cette facture a deja ete payee' : 'Cette facture a expire ou a ete annulee'}
        </p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white text-center">
          <h1 className="text-xl font-bold">Souk.AI</h1>
          <p className="text-purple-100 text-sm mt-1">Paiement securise</p>
        </div>

        {/* Invoice Details */}
        <div className="p-6 space-y-4">
          {invoice.customer_name && (
            <p className="text-gray-600 text-sm">Client: <span className="font-medium text-gray-900">{invoice.customer_name}</span></p>
          )}

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500 mb-2">Articles</p>
            {invoice.items?.map((item, i) => (
              <div key={i} className="flex justify-between text-sm py-1">
                <span>{item.product_name} x{item.quantity}</span>
                <span className="font-medium">{(item.quantity * item.unit_price).toFixed(2)} MAD</span>
              </div>
            ))}
            <div className="border-t mt-2 pt-2 flex justify-between font-bold">
              <span>Total</span>
              <span className="text-purple-700 text-lg">{invoice.total_amount.toFixed(2)} MAD</span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-3">
            <p className="font-medium text-sm text-gray-700">Mode de paiement</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['NFC_SOUKCARD', 'Carte Souk.AI', FiSmartphone],
                ['NFC_BANK', 'Carte bancaire', FiCreditCard],
              ].map(([val, label, Icon]) => (
                <button key={val} onClick={() => setMethod(val)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${method === val ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <Icon size={24} className={method === val ? 'text-purple-600' : 'text-gray-400'} />
                  <span className={`text-xs font-medium ${method === val ? 'text-purple-700' : 'text-gray-500'}`}>{label}</span>
                </button>
              ))}
            </div>

            {method === 'NFC_SOUKCARD' && (
              <div className="space-y-2">
                <input value={cardNumber} onChange={e => setCardNumber(e.target.value)} placeholder="Numero de carte (9212...)" className="w-full px-3 py-2 border rounded-lg text-sm" />
                <input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="Code PIN" className="w-full px-3 py-2 border rounded-lg text-sm" maxLength={6} />
              </div>
            )}

            {method === 'NFC_BANK' && (
              <div className="bg-blue-50 rounded-lg p-4 text-center text-sm text-blue-700">
                <FiCreditCard size={32} className="mx-auto mb-2 text-blue-400" />
                <p>Approchez votre carte bancaire du terminal NFC</p>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}

          <button onClick={handlePay} disabled={paying}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 disabled:opacity-50">
            {paying ? 'Traitement...' : `Payer ${invoice.total_amount.toFixed(2)} MAD`}
          </button>
        </div>
      </div>
    </div>
  )
}
