import { useState, useEffect } from 'react'
import { FiPlus, FiSearch, FiPhone, FiChevronRight, FiX, FiArrowUp, FiArrowDown, FiTrash2, FiEdit2, FiShoppingBag, FiMessageCircle } from 'react-icons/fi'
import client from '../api/client'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

export default function Customers() {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', notes: '', whatsapp_opt_in: false })
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [entryForm, setEntryForm] = useState({ type: 'CREDIT', amount: '', description: '' })
  const [addingEntry, setAddingEntry] = useState(false)
  const [purchases, setPurchases] = useState([])
  const [activeTab, setActiveTab] = useState('entries')
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', phone: '', notes: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [sendingReminder, setSendingReminder] = useState(false)

  const handleRemind = async () => {
    if (!detail?.phone) return toast.error('Ce client n\'a pas de numéro de téléphone')
    if (detail.balance <= 0) return toast.error('Ce client n\'a pas de solde en cours')
    setSendingReminder(true)
    try {
      await client.post(`/customers/${selected}/remind`)
      toast.success('Rappel WhatsApp envoyé ✅')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Échec de l\'envoi du rappel')
    } finally {
      setSendingReminder(false)
    }
  }

  const fetchCustomers = () => {
    setLoading(true)
    client.get('/customers/')
      .then(r => setCustomers(r.data))
      .catch(() => toast.error('Erreur chargement clients'))
      .finally(() => setLoading(false))
  }

  const fetchDetail = (id) => {
    client.get(`/customers/${id}`)
      .then(r => { setDetail(r.data); setSelected(id); setActiveTab('entries') })
      .catch(() => toast.error('Erreur chargement detail'))
    client.get(`/customers/${id}/purchases`)
      .then(r => setPurchases(r.data))
      .catch(() => setPurchases([]))
  }

  useEffect(() => { fetchCustomers() }, [])

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  )

  const totalOwed = customers.reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0)

  const handleAddCustomer = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await client.post('/customers/', form)
      toast.success('Client ajoute')
      setShowAdd(false)
      setForm({ name: '', phone: '', notes: '', whatsapp_opt_in: false })
      fetchCustomers()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const handleAddEntry = async (e) => {
    e.preventDefault()
    if (!entryForm.amount || parseFloat(entryForm.amount) <= 0) return toast.error(t('common.error'))
    setAddingEntry(true)
    try {
      await client.post(`/customers/${selected}/entries`, {
        type: entryForm.type,
        amount: parseFloat(entryForm.amount),
        description: entryForm.description || null,
      })
      toast.success(entryForm.type === 'CREDIT' ? 'Credit ajoute' : 'Paiement enregistre')
      setEntryForm({ type: 'CREDIT', amount: '', description: '' })
      fetchDetail(selected)
      fetchCustomers()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur')
    } finally {
      setAddingEntry(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await client.delete(`/customers/${id}`)
      toast.success('Client supprime')
      if (selected === id) { setSelected(null); setDetail(null) }
      fetchCustomers()
      setConfirmDelete(null)
    } catch { toast.error('Erreur suppression') }
  }

  const openEdit = () => {
    if (!detail) return
    setEditForm({ name: detail.name, phone: detail.phone || '', notes: detail.notes || '', whatsapp_opt_in: !!detail.whatsapp_opt_in })
    setShowEdit(true)
  }

  const handleEditCustomer = async (e) => {
    e.preventDefault()
    setEditSaving(true)
    try {
      await client.patch(`/customers/${selected}`, editForm)
      toast.success('Client modifie')
      setShowEdit(false)
      fetchDetail(selected)
      fetchCustomers()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur modification')
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-7rem)]">
      {/* Left: Customer list */}
      <div className="w-full lg:w-96 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('customers.title')}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{t('customers.totalOwed')}: <span className="font-bold text-red-600">{totalOwed.toFixed(2)} MAD</span></p>
          </div>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700">
            <FiPlus className="h-4 w-4" /> {t('customers.newClient')}
          </button>
        </div>

        <div className="relative mb-3">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('customers.searchClient')}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">{search ? t('common.noResults') : t('customers.noClient')}</p>
            </div>
          ) : filtered.map(c => (
            <button
              key={c.id}
              onClick={() => fetchDetail(c.id)}
              className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between group ${
                selected === c.id ? 'bg-violet-50 border border-violet-200' : 'bg-white border border-gray-100 hover:border-gray-200'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm text-gray-900 truncate">{c.name}</p>
                {c.phone && <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><FiPhone className="h-3 w-3" />{c.phone}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${c.balance > 0 ? 'text-red-600' : c.balance < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                  {c.balance > 0 ? `${c.balance.toFixed(2)}` : c.balance < 0 ? `+${Math.abs(c.balance).toFixed(2)}` : '0'} MAD
                </span>
                <FiChevronRight className="h-4 w-4 text-gray-300" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right: Customer detail */}
      <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden min-h-0">
        {!detail ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <FiSearch className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t('customers.selectClient')}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">{detail.name}</h2>
                {detail.phone && <p className="text-sm text-gray-500">{detail.phone}</p>}
                {detail.notes && <p className="text-xs text-gray-400 mt-0.5">{detail.notes}</p>}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {detail.phone && detail.balance > 0 && (
                    <button onClick={handleRemind} disabled={sendingReminder}
                      className="p-2 hover:bg-green-100 rounded-xl transition-colors disabled:opacity-50" title="Rappel WhatsApp">
                      <FiMessageCircle className="h-4 w-4 text-green-600" />
                    </button>
                  )}
                  <button onClick={openEdit} className="p-2 hover:bg-violet-100 rounded-xl transition-colors" title="Modifier">
                    <FiEdit2 className="h-4 w-4 text-violet-600" />
                  </button>
                  <button onClick={() => setConfirmDelete(selected)} className="p-2 hover:bg-red-100 rounded-xl transition-colors" title="Supprimer">
                    <FiTrash2 className="h-4 w-4 text-red-500" />
                  </button>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{t('customers.balance')}</p>
                  <p className={`text-xl font-black ${detail.balance > 0 ? 'text-red-600' : detail.balance < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                    {detail.balance.toFixed(2)} MAD
                  </p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b">
              <button onClick={() => setActiveTab('entries')}
                className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${activeTab === 'entries' ? 'text-violet-600 border-b-2 border-violet-600' : 'text-gray-500 hover:text-gray-700'}`}>
                {t('customers.creditPayments')}
              </button>
              <button onClick={() => setActiveTab('purchases')}
                className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${activeTab === 'purchases' ? 'text-violet-600 border-b-2 border-violet-600' : 'text-gray-500 hover:text-gray-700'}`}>
                <FiShoppingBag className={`h-3.5 w-3.5 inline ${isRtl ? 'ml-1' : 'mr-1'}`} />{t('customers.purchases')} ({purchases.length})
              </button>
            </div>

            {activeTab === 'entries' && (
              <>
                {/* Add entry form */}
                <form onSubmit={handleAddEntry} className="px-6 py-4 border-b bg-violet-50/50">
                  <div className="flex gap-2 items-end flex-wrap">
                    <div className="flex bg-gray-100 rounded-xl p-0.5">
                      <button type="button"
                        onClick={() => setEntryForm(f => ({ ...f, type: 'CREDIT' }))}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${entryForm.type === 'CREDIT' ? 'bg-red-600 text-white' : 'text-gray-600'}`}
                      >
                        <FiArrowUp className={`h-3 w-3 inline ${isRtl ? 'ml-1' : 'mr-1'}`} />{t('customers.credit')}
                      </button>
                      <button type="button"
                        onClick={() => setEntryForm(f => ({ ...f, type: 'PAYMENT' }))}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${entryForm.type === 'PAYMENT' ? 'bg-green-600 text-white' : 'text-gray-600'}`}
                      >
                        <FiArrowDown className={`h-3 w-3 inline ${isRtl ? 'ml-1' : 'mr-1'}`} />{t('customers.payment')}
                      </button>
                    </div>
                    <input
                      type="number" step="0.01" min="0.01" placeholder={t('customers.amountPlaceholder')}
                      value={entryForm.amount} onChange={e => setEntryForm(f => ({ ...f, amount: e.target.value }))}
                      className="w-28 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                      required
                    />
                    <input
                      placeholder={t('customers.descriptionOptional')}
                      value={entryForm.description} onChange={e => setEntryForm(f => ({ ...f, description: e.target.value }))}
                      className="flex-1 min-w-[120px] border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <button type="submit" disabled={addingEntry}
                      className="px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
                      {addingEntry ? '...' : t('customers.addEntry')}
                    </button>
                  </div>
                </form>

                {/* Entries list */}
                <div className="flex-1 overflow-y-auto divide-y">
                  {(detail.entries || []).length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-sm">{t('customers.noEntries')}</div>
                  ) : detail.entries.map(entry => (
                    <div key={entry.id} className="px-6 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          entry.type === 'CREDIT' ? 'bg-red-100' : 'bg-green-100'
                        }`}>
                          {entry.type === 'CREDIT'
                            ? <FiArrowUp className="h-4 w-4 text-red-600" />
                            : <FiArrowDown className="h-4 w-4 text-green-600" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {entry.type === 'CREDIT' ? t('customers.credit') : t('customers.payment')}
                          </p>
                          {entry.description && <p className="text-xs text-gray-500">{entry.description}</p>}
                          <p className="text-xs text-gray-400">{new Date(entry.created_at).toLocaleString(isRtl ? 'ar-MA' : 'fr-FR')}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-bold ${entry.type === 'CREDIT' ? 'text-red-600' : 'text-green-600'}`}>
                        {entry.type === 'CREDIT' ? '+' : '-'}{entry.amount.toFixed(2)} MAD
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeTab === 'purchases' && (
              <div className="flex-1 overflow-y-auto">
                {purchases.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <FiShoppingBag className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{t('customers.noPurchases')}</p>
                    <p className="text-xs mt-1">{t('customers.purchasesHint')}</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className={`${isRtl ? 'text-right' : 'text-left'} px-6 py-3 font-semibold text-gray-600`}>{t('customers.product')}</th>
                        <th className="text-center px-3 py-3 font-semibold text-gray-600">{t('common.quantity')}</th>
                        <th className={`${isRtl ? 'text-left' : 'text-right'} px-3 py-3 font-semibold text-gray-600`}>{t('customers.unitPrice')}</th>
                        <th className={`${isRtl ? 'text-left' : 'text-right'} px-3 py-3 font-semibold text-gray-600`}>{t('common.total')}</th>
                        <th className={`${isRtl ? 'text-left' : 'text-right'} px-6 py-3 font-semibold text-gray-600`}>{t('common.date')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {purchases.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-6 py-3 font-medium text-gray-900">{p.product_name}</td>
                          <td className="text-center px-3 py-3 text-gray-600">{p.quantity}</td>
                          <td className="text-right px-3 py-3 text-gray-600">{p.unit_price.toFixed(2)}</td>
                          <td className="text-right px-3 py-3 font-bold text-gray-900">{p.total.toFixed(2)} MAD</td>
                          <td className={`${isRtl ? 'text-left' : 'text-right'} px-6 py-3 text-gray-400 text-xs`}>{new Date(p.date).toLocaleDateString(isRtl ? 'ar-MA' : 'fr-FR')}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2">
                      <tr>
                        <td colSpan="3" className="px-6 py-3 font-bold text-gray-700">{t('customers.totalPurchases')}</td>
                        <td className="text-right px-3 py-3 font-black text-violet-600">{purchases.reduce((s, p) => s + p.total, 0).toFixed(2)} MAD</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit customer modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowEdit(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-gray-900">{t('customers.editClient')}</h3>
              <button onClick={() => setShowEdit(false)} className="p-2 hover:bg-gray-100 rounded-xl"><FiX className="h-5 w-5 text-gray-500" /></button>
            </div>
            <form onSubmit={handleEditCustomer} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.name')} *</label>
                <input required value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.phone')}</label>
                <input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.notes')}</label>
                <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500" rows={2} />
              </div>
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-violet-600" checked={!!editForm.whatsapp_opt_in}
                  onChange={e => setEditForm(f => ({ ...f, whatsapp_opt_in: e.target.checked }))} />
                <span>{t('customers.optIn')}</span>
              </label>
              <button type="submit" disabled={editSaving}
                className="w-full py-2.5 bg-violet-600 text-white rounded-xl font-semibold text-sm hover:bg-violet-700 disabled:opacity-50">
                {editSaving ? t('common.saving') : t('common.save')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <FiTrash2 className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="font-bold text-gray-900 text-lg mb-2">{t('customers.deleteClient')}</h3>
            <p className="text-sm text-gray-500 mb-6">{t('customers.deleteHint')}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-medium">
                {t('common.cancel')}
              </button>
              <button onClick={() => handleDelete(confirmDelete)}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 text-sm font-semibold">
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add customer modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-gray-900">{t('customers.newClient')}</h3>
              <button onClick={() => setShowAdd(false)} className="p-2 hover:bg-gray-100 rounded-xl"><FiX className="h-5 w-5 text-gray-500" /></button>
            </div>
            <form onSubmit={handleAddCustomer} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.name')} *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder={isRtl ? 'مثال: أحمد بنعلي' : 'Ex: Ahmed Benali'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.phone')}</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="+212 6XX XXX XXX" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.notes')}</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder={isRtl ? 'ملاحظات اختيارية...' : 'Notes optionnelles...'} rows={2} />
              </div>
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-violet-600" checked={!!form.whatsapp_opt_in}
                  onChange={e => setForm(f => ({ ...f, whatsapp_opt_in: e.target.checked }))} />
                <span>{t('customers.optIn')}</span>
              </label>
              <button type="submit" disabled={saving}
                className="w-full py-2.5 bg-violet-600 text-white rounded-xl font-semibold text-sm hover:bg-violet-700 disabled:opacity-50">
                {saving ? t('common.saving') : t('common.add')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
