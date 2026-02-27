import { useState, useEffect } from 'react'
import { merchantsAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Settings() {
  const { merchant: authMerchant } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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
    </div>
  )
}
