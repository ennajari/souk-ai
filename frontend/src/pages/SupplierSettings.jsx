import { useState, useEffect } from 'react'
import {
  FiTrash2, FiAlertTriangle, FiPhone, FiCalendar, FiCheckCircle, FiTruck
} from 'react-icons/fi'
import { merchantsAPI, authAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

export default function SupplierSettings() {
  const { t, i18n } = useTranslation()
  const { logout } = useAuth()
  const confirmWord = t('settings.confirmWord')
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState({
    business_name: '', email: '', preferred_language: 'AR',
  })

  useEffect(() => {
    merchantsAPI.me()
      .then((res) => {
        setProfile(res.data)
        setForm({
          business_name: res.data.business_name || '',
          email: res.data.email || '',
          preferred_language: res.data.preferred_language || 'AR',
        })
      })
      .catch(() => toast.error(t('common.error')))
      .finally(() => setLoading(false))
  }, [])

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await merchantsAPI.update(form)
      toast.success(t('settings.saved'))
    } catch {
      toast.error(t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    )
  }

  return (
    <div className="space-y-2 max-w-2xl">
      <div>
        <h1 className="text-2xl font-black text-gray-900">{t('settings.title')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('supplierPortal.settingsSubtitle')}</p>
      </div>

      <div className="space-y-5 pt-2">

        {/* Profile form */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <FiTruck className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">{t('settings.businessInfo')}</h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">{t('settings.businessName')}</label>
              <input name="business_name" value={form.business_name} onChange={handleChange}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">{t('settings.email')}</label>
              <input name="email" type="email" value={form.email} onChange={handleChange}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">{t('settings.language')}</label>
              <select name="preferred_language" value={form.preferred_language} onChange={handleChange}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm">
                {['AR', 'FR', 'EN'].map(l => <option key={l} value={l}>{t(`settings.languages.${l}`)}</option>)}
              </select>
            </div>
            <button type="submit" disabled={saving}
              className="px-5 py-2.5 bg-gradient-to-r from-brand-600 to-brand-600 text-white rounded-xl hover:from-brand-700 hover:to-brand-700 text-sm font-semibold disabled:opacity-50 shadow-sm transition-all">
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </form>
        </div>

        {/* Account info */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">{t('settings.accountInfo')}</h2>
          <div className="space-y-0 divide-y divide-gray-50">
            {[
              { icon: FiPhone, label: t('common.phone'), value: profile?.phone_number && `+${profile.phone_number}` },
              { icon: FiTruck, label: t('supplierPortal.accountType'), value: <span className="px-2.5 py-0.5 bg-brand-100 text-brand-700 rounded-full text-xs font-semibold">{t('register.supplier')}</span> },
              { icon: FiCalendar, label: t('settings.memberSince'), value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString(i18n.language) : '-' },
              { icon: FiCheckCircle, label: t('common.status'), value: <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">{t('settings.active')}</span> },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2 text-gray-500">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-sm">{label}</span>
                </div>
                <span className="text-sm font-semibold text-gray-800">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Danger zone */}
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-6">
          <h2 className="text-sm font-bold text-red-700 uppercase tracking-wide mb-1 flex items-center gap-2">
            <FiAlertTriangle className="h-4 w-4" /> {t('settings.dangerZone')}
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            {t('settings.dangerHint')}
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 text-sm font-semibold transition-colors"
          >
            <FiTrash2 className="h-4 w-4" /> {t('settings.deleteAccount')}
          </button>
        </div>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowDeleteModal(false); setDeleteConfirmText('') }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="text-center mb-4">
              <div className="w-14 h-14 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <FiAlertTriangle className="h-7 w-7 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">{t('settings.deleteTitle')}</h3>
              <p className="text-sm text-gray-500 mt-2">
                {t('settings.deleteWarning')}
              </p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('settings.typeToConfirm')} <strong className="text-red-600">{confirmWord}</strong>
              </label>
              <input
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder={confirmWord}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteModal(false); setDeleteConfirmText('') }}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-medium transition-colors">
                {t('common.cancel')}
              </button>
              <button
                onClick={async () => {
                  if (deleteConfirmText !== confirmWord) return toast.error(`${t('settings.typeToConfirm')} ${confirmWord}`)
                  setDeleting(true)
                  try { await authAPI.deleteAccount(); toast.success(t('settings.deleted')); logout() }
                  catch { toast.error(t('common.error')) }
                  finally { setDeleting(false) }
                }}
                disabled={deleteConfirmText !== confirmWord || deleting}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {deleting ? t('settings.deleting') : t('settings.deleteForever')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
