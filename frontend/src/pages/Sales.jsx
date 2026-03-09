import { useState, useEffect, useRef } from 'react'
import { FiDollarSign, FiPrinter } from 'react-icons/fi'
import { productsAPI, transactionsAPI } from '../api/client'
import toast from 'react-hot-toast'

export default function Sales() {
  const [products, setProducts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ product_id: '', quantity: 1, unit_price: 0, type: 'SALE', source: 'WEB' })
  const printRef = useRef()

  useEffect(() => {
    Promise.all([
      productsAPI.list().catch(() => ({ data: [] })),
      transactionsAPI.list('SALE', 20).catch(() => ({ data: [] })),
    ]).then(([prodRes, txnRes]) => {
      setProducts(prodRes.data)
      setTransactions(txnRes.data)
    }).finally(() => setLoading(false))
  }, [])

  const handleProductChange = (e) => {
    const pid = e.target.value
    const product = products.find((p) => p.id === pid)
    setForm({ ...form, product_id: pid, unit_price: product?.unit_price || 0 })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.product_id) return toast.error('Selectionnez un produit')
    try {
      await transactionsAPI.create(form)
      toast.success('Vente enregistree!')
      setForm({ ...form, product_id: '', quantity: 1, unit_price: 0 })
      const res = await transactionsAPI.list('SALE', 20)
      setTransactions(res.data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur')
    }
  }

  const handlePrint = () => {
    const content = printRef.current
    if (!content) return
    const win = window.open('', '_blank', 'width=400,height=600')
    win.document.write(`
      <!DOCTYPE html>
      <html><head><title>Recu de vente - Souk.AI</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; padding: 12px; font-size: 12px; max-width: 300px; margin: auto; }
        .header { text-align: center; border-bottom: 2px dashed #333; padding-bottom: 8px; margin-bottom: 8px; }
        .header h1 { font-size: 18px; font-weight: bold; }
        .header p { font-size: 10px; color: #666; }
        .date { text-align: center; font-size: 10px; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; border-bottom: 1px solid #333; padding: 4px 0; font-size: 11px; }
        td { padding: 3px 0; font-size: 11px; }
        .right { text-align: right; }
        .total-row { border-top: 2px dashed #333; margin-top: 8px; padding-top: 8px; font-weight: bold; font-size: 14px; display: flex; justify-content: space-between; }
        .footer { text-align: center; margin-top: 12px; padding-top: 8px; border-top: 1px dashed #999; font-size: 9px; color: #999; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <div class="header">
        <h1>SOUK.AI</h1>
        <p>Recu de vente</p>
      </div>
      <div class="date">${new Date().toLocaleString('fr-FR')}</div>
      <table>
        <thead><tr><th>Produit</th><th class="right">Qte</th><th class="right">Prix</th><th class="right">Total</th></tr></thead>
        <tbody>
          ${transactions.map(t => `
            <tr>
              <td>${t.product_name_fr || t.product_name_ar || '-'}</td>
              <td class="right">${t.quantity}</td>
              <td class="right">${t.unit_price.toFixed(2)}</td>
              <td class="right">${t.total_amount.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="total-row">
        <span>TOTAL</span>
        <span>${transactions.reduce((s, t) => s + t.total_amount, 0).toFixed(2)} MAD</span>
      </div>
      <div class="footer">
        Merci pour votre achat!<br/>
        Souk.AI - Gestion Intelligente
      </div>
      </body></html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 300)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Ventes</h1>
        {transactions.length > 0 && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 text-sm font-medium transition-colors"
          >
            <FiPrinter className="h-4 w-4" /> Imprimer recu
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FiDollarSign className="text-green-600" /> Nouvelle vente
        </h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Produit</label>
            <select
              value={form.product_id}
              onChange={handleProductChange}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
            >
              <option value="">-- Choisir --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name_fr} ({p.name_ar})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantite</label>
            <input
              type="number"
              min="1"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prix unitaire</label>
            <input
              type="number"
              step="0.01"
              value={form.unit_price}
              onChange={(e) => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
            />
          </div>
          <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            Enregistrer
          </button>
        </form>
        {form.product_id && (
          <p className="mt-3 text-sm text-gray-500">
            Total: <span className="font-bold text-gray-900">{(form.quantity * form.unit_price).toFixed(2)} MAD</span>
          </p>
        )}
      </div>

      <div ref={printRef} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Dernieres ventes</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantite</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prix unitaire</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {transactions.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm">
                  <span className="font-medium text-gray-900">{t.product_name_fr || t.product_name_ar}</span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{t.quantity}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{t.unit_price.toFixed(2)} MAD</td>
                <td className="px-6 py-4 text-sm font-bold text-green-600">{t.total_amount.toFixed(2)} MAD</td>
                <td className="px-6 py-4 text-sm text-gray-500">{new Date(t.created_at).toLocaleString('fr-FR')}</td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-400">Aucune vente enregistree.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
