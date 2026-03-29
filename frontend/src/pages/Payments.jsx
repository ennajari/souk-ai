import { useState, useEffect } from 'react'
import { FiCreditCard, FiDollarSign, FiSettings, FiCopy, FiExternalLink } from 'react-icons/fi'
import client from '../api/client'
import toast from 'react-hot-toast'

const METHOD_LABELS = { CMI: 'Carte bancaire (CMI)', CASH_PLUS: 'CashPlus', BANK_TRANSFER: 'Virement bancaire', CASH: 'Especes' }
const STATUS_LABELS = { PENDING: 'En attente', PROCESSING: 'En cours', COMPLETED: 'Complete', FAILED: 'Echoue', REFUNDED: 'Rembourse', CANCELLED: 'Annule' }
const statusColor = {
  PENDING: 'bg-yellow-100 text-yellow-700', PROCESSING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700', FAILED: 'bg-red-100 text-red-700',
  REFUNDED: 'bg-orange-100 text-orange-700', CANCELLED: 'bg-gray-100 text-gray-600',
}

export default function Payments() {
  const [tab, setTab] = useState('history')
  const [payments, setPayments] = useState([])
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [configForm, setConfigForm] = useState({ cmi_merchant_id: '', cmi_api_key: '', cashplus_agent_id: '', cashplus_api_key: '', preferred_method: 'CASH' })

  const fetchData = async () => {
    setLoading(true)
    try {
      const [paymentsRes, configRes] = await Promise.all([
        client.get('/payments/'),
        client.get('/payments/config/me'),
      ])
      setPayments(paymentsRes.data)
      setConfig(configRes.data)
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

  const copyCode = (code) => {
    navigator.clipboard.writeText(code)
    toast.success('Code copie!')
  }

  const totalCompleted = payments.filter(p => p.status === 'COMPLETED').reduce((s, p) => s + p.amount, 0)
  const totalPending = payments.filter(p => p.status === 'PENDING').reduce((s, p) => s + p.amount, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Paiements</h1>
        <p className="text-gray-500 text-sm">CMI, CashPlus et virements bancaires</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Total paye</p>
          <p className="text-2xl font-bold text-green-600">{totalCompleted.toFixed(2)} MAD</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">En attente</p>
          <p className="text-2xl font-bold text-yellow-600">{totalPending.toFixed(2)} MAD</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Transactions</p>
          <p className="text-2xl font-bold text-gray-900">{payments.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {[['history', 'Historique', FiDollarSign], ['config', 'Configuration', FiSettings]].map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === key ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {/* History */}
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
                      {p.external_ref && <span className="cursor-pointer hover:text-purple-600" onClick={() => copyCode(p.external_ref)}>{p.external_ref} <FiCopy size={12} className="inline" /></span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{p.description || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Config */}
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
