import { useState, useEffect } from 'react'
import {
  FiTrash2, FiAlertTriangle, FiPhone, FiCalendar, FiCheckCircle, FiTruck
} from 'react-icons/fi'
import { merchantsAPI, authAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function SupplierSettings() {
  const { logout } = useAuth()
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
      .catch(() => toast.error('Erreur chargement profil'))
      .finally(() => setLoading(false))
  }, [])

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await merchantsAPI.update(form)
      toast.success('Profil mis a jour')
    } catch {
      toast.error('Erreur sauvegarde')
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
        <h1 className="text-2xl font-black text-gray-900">Parametres</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configuration de votre compte fournisseur</p>
      </div>

      <div className="space-y-5 pt-2">

        {/* Profile form */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <FiTruck className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Informations de l'entreprise</h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Nom de l'entreprise</label>
              <input name="business_name" value={form.business_name} onChange={handleChange}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
              <input name="email" type="email" value={form.email} onChange={handleChange}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Langue preferee</label>
              <select name="preferred_language" value={form.preferred_language} onChange={handleChange}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm">
                <option value="AR">Arabe / Darija</option>
                <option value="FR">Francais</option>
              </select>
            </div>
            <button type="submit" disabled={saving}
              className="px-5 py-2.5 bg-gradient-to-r from-brand-600 to-brand-600 text-white rounded-xl hover:from-brand-700 hover:to-brand-700 text-sm font-semibold disabled:opacity-50 shadow-sm transition-all">
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </form>
        </div>

        {/* Account info */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Informations du compte</h2>
          <div className="space-y-0 divide-y divide-gray-50">
            {[
              { icon: FiPhone, label: 'Telephone', value: profile?.phone_number },
              { icon: FiTruck, label: 'Type de compte', value: <span className="px-2.5 py-0.5 bg-brand-100 text-brand-700 rounded-full text-xs font-semibold">Fournisseur</span> },
              { icon: FiCalendar, label: 'Membre depuis', value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString('fr-FR') : '-' },
              { icon: FiCheckCircle, label: 'Statut', value: <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">Actif</span> },
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
            <FiAlertTriangle className="h-4 w-4" /> Zone dangereuse
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Suppression permanente de toutes vos donnees.
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 text-sm font-semibold transition-colors"
          >
            <FiTrash2 className="h-4 w-4" /> Supprimer mon compte
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
              <h3 className="text-lg font-bold text-gray-900">Supprimer votre compte ?</h3>
              <p className="text-sm text-gray-500 mt-2">
                Action <strong>irreversible</strong>. Toutes vos donnees seront supprimees.
              </p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Tapez <strong className="text-red-600">SUPPRIMER</strong> pour confirmer
              </label>
              <input
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="SUPPRIMER"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteModal(false); setDeleteConfirmText('') }}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-medium transition-colors">
                Annuler
              </button>
              <button
                onClick={async () => {
                  if (deleteConfirmText !== 'SUPPRIMER') return toast.error('Tapez SUPPRIMER pour confirmer')
                  setDeleting(true)
                  try { await authAPI.deleteAccount(); toast.success('Compte supprime'); logout() }
                  catch { toast.error('Erreur lors de la suppression') }
                  finally { setDeleting(false) }
                }}
                disabled={deleteConfirmText !== 'SUPPRIMER' || deleting}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {deleting ? 'Suppression...' : 'Supprimer definitivement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
