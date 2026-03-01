import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authAPI } from '../api/client'
import toast from 'react-hot-toast'
import {
  FiEye, FiEyeOff, FiUser, FiPhone, FiMail, FiLock,
  FiGrid, FiGlobe, FiCheckCircle, FiShoppingBag, FiArrowRight
} from 'react-icons/fi'

const categories = [
  { value: 'GROCERY', label: 'Épicerie', icon: FiShoppingBag },
  { value: 'BAKERY', label: 'Boulangerie', icon: FiShoppingBag },
  { value: 'BUTCHER', label: 'Boucherie', icon: FiShoppingBag },
  { value: 'PHARMACY', label: 'Pharmacie', icon: FiShoppingBag },
  { value: 'RESTAURANT', label: 'Restaurant', icon: FiShoppingBag },
  { value: 'MARKET', label: 'Marché', icon: FiShoppingBag },
  { value: 'OTHER', label: 'Autre', icon: FiShoppingBag },
]

const BENEFITS = [
  { icon: FiCheckCircle, text: 'Gratuit — aucune carte bancaire requise' },
  { icon: FiCheckCircle, text: 'Opérationnel en moins de 2 minutes' },
  { icon: FiCheckCircle, text: 'Support en Darija, Français et Anglais' },
  { icon: FiCheckCircle, text: 'Données sécurisées et confidentielles' },
]

export default function Register() {
  const [form, setForm] = useState({
    phone_number: '',
    password: '',
    business_name: '',
    email: '',
    preferred_language: 'AR',
    business_category: 'GROCERY',
  })
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await authAPI.register(form)
      login(data.access_token, {
        id: data.merchant_id,
        business_name: data.business_name,
        phone_number: form.phone_number,
      })
      toast.success('Compte créé avec succès!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors de l'inscription")
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full pl-10 pr-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none bg-gray-50 text-sm transition font-medium"

  return (
    <div className="min-h-screen flex bg-gray-50">

      {/* ── Left panel: branding ── */}
      <div className="hidden lg:flex lg:w-[45%] bg-gray-950 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/40 via-gray-950 to-indigo-900/30" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-violet-600/10 rounded-full -translate-y-1/3 translate-x-1/3 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-indigo-600/10 rounded-full translate-y-1/3 -translate-x-1/3 blur-2xl" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }} />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-violet-900/50">
              <span className="text-white font-black text-lg">S</span>
            </div>
            <span className="text-white text-2xl font-black tracking-tight">Souk.AI</span>
          </div>
          <p className="text-gray-500 text-sm mt-2">Gestion Intelligente pour Commerçants Marocains</p>
        </div>

        {/* Pitch */}
        <div className="relative z-10 space-y-6">
          <div>
            <p className="text-violet-400 text-xs font-bold tracking-widest uppercase mb-3">REJOIGNEZ-NOUS</p>
            <h2 className="text-white text-4xl font-black leading-tight">
              Votre commerce,<br />
              plus intelligent<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">dès aujourd'hui</span>
            </h2>
          </div>

          {/* Benefits */}
          <div className="space-y-3">
            {BENEFITS.map((b) => (
              <div key={b.text} className="flex items-center gap-3">
                <b.icon className="h-4 w-4 text-emerald-400 flex-shrink-0" strokeWidth={2.5} />
                <p className="text-gray-400 text-sm">{b.text}</p>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: '500+', label: 'Commerçants' },
              { value: '24/7', label: 'Disponible' },
              { value: '3', label: 'Langues' },
            ].map(({ value, label }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <p className="text-white font-black text-xl leading-none">{value}</p>
                <p className="text-gray-500 text-xs mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Copyright */}
        <div className="relative z-10">
          <p className="text-gray-600 text-xs">
            © {new Date().getFullYear()} Souk.AI — Tous droits réservés.<br />
            Plateforme réservée aux commerçants marocains.
          </p>
        </div>
      </div>

      {/* ── Right panel: form ── */}
      <div className="flex-1 flex flex-col justify-center px-6 py-10 lg:px-12 overflow-y-auto">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-black text-sm">S</span>
          </div>
          <span className="text-gray-900 text-xl font-black">Souk.AI</span>
        </div>

        <div className="max-w-md w-full mx-auto">
          <div className="mb-7">
            <h1 className="text-3xl font-black text-gray-900">Créer un compte</h1>
            <p className="text-gray-500 text-sm mt-1.5">Gérez votre commerce depuis WhatsApp en quelques minutes</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Business name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Nom du commerce</label>
              <div className="relative">
                <FiShoppingBag className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  name="business_name"
                  required
                  value={form.business_name}
                  onChange={handleChange}
                  placeholder="Ex: Épicerie Ahmed"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Numéro de téléphone</label>
              <div className="relative">
                <FiPhone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  name="phone_number"
                  type="tel"
                  required
                  value={form.phone_number}
                  onChange={handleChange}
                  placeholder="212612345678"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email <span className="text-gray-400 font-normal">(optionnel)</span>
              </label>
              <div className="relative">
                <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="email@exemple.com"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Mot de passe</label>
              <div className="relative">
                <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  required
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Minimum 6 caractères"
                  className="w-full pl-10 pr-12 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none bg-gray-50 text-sm transition font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  {showPass ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Category + Language */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Catégorie</label>
                <div className="relative">
                  <FiGrid className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <select
                    name="business_category"
                    value={form.business_category}
                    onChange={handleChange}
                    className="w-full pl-9 pr-3 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none bg-gray-50 text-sm appearance-none font-medium"
                  >
                    {categories.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Langue</label>
                <div className="relative">
                  <FiGlobe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <select
                    name="preferred_language"
                    value={form.preferred_language}
                    onChange={handleChange}
                    className="w-full pl-9 pr-3 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none bg-gray-50 text-sm appearance-none font-medium"
                  >
                    <option value="AR">Darija / عربية</option>
                    <option value="FR">Français</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-all shadow-xl shadow-violet-200 disabled:opacity-50 disabled:shadow-none text-sm flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Création en cours...
                </>
              ) : (
                <>
                  Créer mon compte gratuit
                  <FiArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Déjà un compte?{' '}
            <Link to="/login" className="text-violet-600 hover:text-violet-700 font-bold transition-colors">
              Se connecter
            </Link>
          </p>

          {/* Copyright */}
          <p className="text-center text-xs text-gray-400 mt-8 border-t border-gray-100 pt-4">
            © {new Date().getFullYear()} <span className="font-semibold text-gray-500">Souk.AI</span> — Tous droits réservés.<br />
            Plateforme réservée aux commerçants marocains.
          </p>
        </div>
      </div>
    </div>
  )
}
