import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  FiTrash2, FiAlertTriangle, FiDatabase, FiArrowRight,
  FiStar, FiCreditCard, FiShoppingCart, FiMonitor, FiPhone,
  FiCalendar, FiCheckCircle
} from 'react-icons/fi'
import { merchantsAPI, authAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'

function ToolCard({ to, icon: Icon, title, desc, color = 'violet' }) {
  const colors = {
    violet:  { border: 'border-violet-100',  bg: 'bg-violet-50',  icon: 'text-violet-600' },
    cyan:    { border: 'border-cyan-100',    bg: 'bg-cyan-50',    icon: 'text-cyan-600' },
    emerald: { border: 'border-emerald-100', bg: 'bg-emerald-50', icon: 'text-emerald-600' },
    orange:  { border: 'border-orange-100',  bg: 'bg-orange-50',  icon: 'text-orange-600' },
    indigo:  { border: 'border-indigo-100',  bg: 'bg-indigo-50',  icon: 'text-indigo-600' },
    pink:    { border: 'border-pink-100',    bg: 'bg-pink-50',    icon: 'text-pink-600' },
    gray:    { border: 'border-gray-100',    bg: 'bg-gray-50',    icon: 'text-gray-500' },
  }
  const c = colors[color] || colors.violet
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 p-3.5 rounded-xl border ${c.border} ${c.bg} hover:shadow-sm transition-all group`}
    >
      <div className="p-2 rounded-lg bg-white shadow-sm flex-shrink-0">
        <Icon className={`h-4 w-4 ${c.icon}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 leading-none">{title}</p>
        <p className="text-xs text-gray-400 mt-0.5 truncate">{desc}</p>
      </div>
      <FiArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
    </Link>
  )
}

export default function Settings() {
  const { logout } = useAuth()
  const { i18n } = useTranslation()
  const [profile, setProfile]               = useState(null)
  const [loading, setLoading]               = useState(true)
  const [saving, setSaving]                 = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting]             = useState(false)
  const [form, setForm] = useState({
    business_name: '', email: '', preferred_language: 'AR', business_category: 'GROCERY',
  })

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

  const handleChange = (e) => {
    const val = e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value
    setForm({ ...form, [e.target.name]: val })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await merchantsAPI.update(form)
      toast.success('Profil mis à jour')
    } catch {
      toast.error('Erreur sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Paramètres</h1>
        <p className="text-sm text-gray-400 mt-0.5">Profil, outils avancés et configuration</p>
      </div>

      {/* ── 2-column grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 pt-2">

        {/* ══ LEFT COLUMN ══ */}
        <div className="space-y-5">

          {/* Profile form */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Informations du commerce</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Nom du commerce</label>
                <input name="business_name" value={form.business_name} onChange={handleChange}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
                <input name="email" type="email" value={form.email} onChange={handleChange}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Catégorie</label>
                  <select name="business_category" value={form.business_category} onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none text-sm">
                    <option value="GROCERY">Épicerie</option>
                    <option value="BAKERY">Boulangerie</option>
                    <option value="BUTCHER">Boucherie</option>
                    <option value="PHARMACY">Pharmacie</option>
                    <option value="RESTAURANT">Restaurant</option>
                    <option value="MARKET">Marché</option>
                    <option value="OTHER">Autre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Langue du bot</label>
                  <select name="preferred_language" value={form.preferred_language} onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none text-sm">
                    <option value="AR">Arabe / Darija</option>
                    <option value="FR">Français</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={saving}
                className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-700 hover:to-purple-700 text-sm font-semibold disabled:opacity-50 shadow-sm transition-all">
                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </form>
          </div>

          {/* Account info */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Informations du compte</h2>
            <div className="space-y-0 divide-y divide-gray-50">
              {[
                { icon: FiPhone,       label: 'Téléphone',     value: profile?.phone_number },
                { icon: FiCalendar,    label: 'Membre depuis', value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString('fr-FR') : '-' },
                { icon: FiCheckCircle, label: 'Statut',        value: <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">Actif</span> },
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
            <p className="text-xs text-gray-400 mb-4">
              Suppression permanente de toutes vos données.
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 text-sm font-semibold transition-colors"
            >
              <FiTrash2 className="h-4 w-4" /> Supprimer mon compte
            </button>
          </div>
        </div>

        {/* ══ RIGHT COLUMN ══ */}
        <div className="space-y-5">

          {/* Outils mensuels */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-1">Outils & Modules avancés</h2>
            <p className="text-xs text-gray-400 mb-4">Utilisés occasionnellement — configuration initiale ou mensuelle.</p>
            <div className="grid grid-cols-1 gap-2">
              <ToolCard to="/credit"             icon={FiStar}         title="Score de crédit"      desc="Score de crédit bancable basé sur vos ventes"  color="violet" />
              <ToolCard to="/my-catalogue"        icon={FiShoppingCart} title="Catalogue en ligne"  desc="Partagez votre catalogue produits public"      color="emerald" />
              <ToolCard to="/payments"            icon={FiCreditCard}   title="Paiements"           desc="Modes de règlement et suivi des paiements"     color="orange" />
              <ToolCard to="/sage-import"         icon={FiDatabase}     title="Import Sage 100"     desc="Import depuis votre logiciel comptable"         color="gray" />
              <ToolCard to="/admin"               icon={FiMonitor}      title="Administration"      desc="Monitoring système et gestion des comptes"      color="gray" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Delete Modal ── */}
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
                Action <strong>irréversible</strong>. Tous vos produits, ventes et données seront supprimés.
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
                  try { await authAPI.deleteAccount(); toast.success('Compte supprimé'); logout() }
                  catch { toast.error('Erreur lors de la suppression') }
                  finally { setDeleting(false) }
                }}
                disabled={deleteConfirmText !== 'SUPPRIMER' || deleting}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {deleting ? 'Suppression...' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
