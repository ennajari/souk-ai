import { useState, useEffect } from 'react'
import { FiPlus, FiTrash2, FiEdit2, FiX, FiUserCheck, FiUsers } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || '/api/v1'
const ROLES = ['MANAGER', 'CASHIER', 'VIEWER']

function api(path, options = {}) {
  const token = localStorage.getItem('token')
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  }).then(async (r) => {
    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      const msg = typeof err.detail === 'string' ? err.detail : Array.isArray(err.detail) ? err.detail.map(e => e.msg || e).join(', ') : 'Erreur'
      throw new Error(msg)
    }
    if (r.status === 204) return null
    return r.json()
  })
}

export default function Employees() {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'

  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ name: '', phone: '', pin_code: '', role: 'CASHIER' })

  const roleLabel = (role) => {
    const map = { MANAGER: t('employees.manager'), CASHIER: t('employees.cashier'), VIEWER: t('employees.viewer') }
    return map[role] || role
  }

  const roleColor = (role) => {
    const map = { MANAGER: 'bg-violet-100 text-violet-700', CASHIER: 'bg-blue-100 text-blue-700', VIEWER: 'bg-gray-100 text-gray-600' }
    return map[role] || 'bg-gray-100 text-gray-600'
  }

  const load = async () => {
    try {
      const data = await api('/employees/')
      setEmployees(data)
    } catch {
      toast.error(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editId) {
        await api(`/employees/${editId}`, { method: 'PATCH', body: JSON.stringify(form) })
        toast.success(t('common.success'))
      } else {
        await api('/employees/', { method: 'POST', body: JSON.stringify(form) })
        toast.success(t('common.success'))
      }
      setShowForm(false)
      setEditId(null)
      setForm({ name: '', phone: '', pin_code: '', role: 'CASHIER' })
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleEdit = (emp) => {
    setEditId(emp.id)
    setForm({ name: emp.name, phone: emp.phone || '', pin_code: '', role: emp.role })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm(t('employees.delete'))) return
    try {
      await api(`/employees/${id}`, { method: 'DELETE' })
      toast.success(t('common.success'))
      load()
    } catch {
      toast.error(t('common.error'))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
            <FiUsers className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{t('employees.title')}</h1>
            <p className="text-sm text-gray-500">{employees.length} {t('employees.active').toLowerCase()}</p>
          </div>
        </div>
        <button
          onClick={() => { setEditId(null); setForm({ name: '', phone: '', pin_code: '', role: 'CASHIER' }); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors text-sm font-medium"
        >
          <FiPlus className="w-4 h-4" />
          {t('employees.add')}
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{editId ? t('common.edit') : t('employees.add')}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('employees.name')}</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('employees.phone')}</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('employees.pin')} <span className="text-gray-400 font-normal">({t('employees.pinHint')})</span>
              </label>
              <input
                type="password"
                required={!editId}
                minLength={4}
                maxLength={6}
                pattern="\d{4,6}"
                value={form.pin_code}
                onChange={(e) => setForm({ ...form, pin_code: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent font-mono tracking-widest"
                dir="ltr"
                placeholder={editId ? '****' : ''}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('employees.role')}</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{roleLabel(r)}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-medium">
                {t('common.cancel')}
              </button>
              <button type="submit" className="flex-1 px-4 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 text-sm font-medium">
                {t('common.save')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Employee list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">{t('common.loading')}</div>
      ) : employees.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <FiUserCheck className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">{t('employees.noEmployees')}</p>
          <p className="text-sm text-gray-400 mt-1">{t('employees.noEmployeesHint')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className={`px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase ${isRtl ? 'text-right' : 'text-left'}`}>{t('employees.name')}</th>
                  <th className={`px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase ${isRtl ? 'text-right' : 'text-left'}`}>{t('employees.phone')}</th>
                  <th className={`px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase ${isRtl ? 'text-right' : 'text-left'}`}>{t('employees.role')}</th>
                  <th className={`px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase ${isRtl ? 'text-right' : 'text-left'}`}>{t('employees.lastLogin')}</th>
                  <th className="px-5 py-3.5"></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center text-violet-600 font-bold text-sm">
                          {emp.name[0]?.toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900">{emp.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 text-sm" dir="ltr">{emp.phone || '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${roleColor(emp.role)}`}>
                        {roleLabel(emp.role)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-sm">
                      {emp.last_login
                        ? new Date(emp.last_login).toLocaleDateString(isRtl ? 'ar-MA' : 'fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : t('employees.never')}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className={`flex gap-1 ${isRtl ? 'justify-start' : 'justify-end'}`}>
                        <button onClick={() => handleEdit(emp)} className="p-2 hover:bg-blue-50 rounded-lg text-blue-500 transition-colors">
                          <FiEdit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(emp.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-400 transition-colors">
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
