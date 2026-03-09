import { useState, useEffect } from 'react'
import { FiTrash2, FiAlertTriangle } from 'react-icons/fi'
import { merchantsAPI, authAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Settings() {
  const { merchant: authMerchant, logout } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState({ business_name: '', email: '', preferred_language: 'AR', business_category: 'GROCERY' })

  useEffect(() => {
    merchantsAPI.me()
      .then((res) => {
        setProfile(res.data)
        setForm({
          business_name: res.data.business_name || '',
          email: res.data.email || '',
          preferred_language: res.data.preferred_language || 'AR',
          business_category: res.data.business_category || 'GROCERY',
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
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div></div>
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Parametres</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold mb-4">Informations du commerce</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom du commerce</label>
            <input
              name="business_name"
              value={form.business_name}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categorie</label>
              <select
                name="business_category"
                value={form.business_category}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              >
                <option value="GROCERY">Epicerie</option>
                <option value="BAKERY">Boulangerie</option>
                <option value="BUTCHER">Boucherie</option>
                <option value="PHARMACY">Pharmacie</option>
                <option value="RESTAURANT">Restaurant</option>
                <option value="MARKET">Marche</option>
                <option value="OTHER">Autre</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Langue</label>
              <select
                name="preferred_language"
                value={form.preferred_language}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              >
                <option value="AR">Arabe / Darija</option>
                <option value="FR">Francais</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold mb-4">Informations du compte</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-500">Telephone</span>
            <span className="font-medium text-gray-900">{profile?.phone_number}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-500">Membre depuis</span>
            <span className="font-medium text-gray-900">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString('fr-FR') : '-'}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-500">Statut</span>
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Actif</span>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
        <h2 className="text-lg font-semibold text-red-700 mb-2 flex items-center gap-2">
          <FiAlertTriangle className="h-5 w-5" /> Zone dangereuse
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          La suppression de votre compte est permanente. Toutes vos donnees (produits, ventes, inventaire) seront definitivement supprimees.
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 text-sm font-semibold transition-colors"
        >
          <FiTrash2 className="h-4 w-4" /> Supprimer mon compte
        </button>
      </div>

      {/* Delete confirmation modal */}
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
                Cette action est <strong>irreversible</strong>. Tous vos produits, ventes, inventaire et conversations seront supprimes.
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
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmText('') }}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-medium transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  if (deleteConfirmText !== 'SUPPRIMER') return toast.error('Tapez SUPPRIMER pour confirmer')
                  setDeleting(true)
                  try {
                    await authAPI.deleteAccount()
                    toast.success('Compte supprime')
                    logout()
                  } catch {
                    toast.error('Erreur lors de la suppression')
                  } finally {
                    setDeleting(false)
                  }
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
