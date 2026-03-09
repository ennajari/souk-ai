import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authAPI } from '../api/client'
import toast from 'react-hot-toast'
import { FiEye, FiEyeOff, FiMessageSquare, FiPackage, FiTrendingUp, FiShield } from 'react-icons/fi'

const FEATURES = [
  { icon: FiMessageSquare, color: 'from-violet-500 to-purple-600', title: 'Bot WhatsApp IA', desc: 'Ventes en Darija, Français ou Anglais' },
  { icon: FiPackage, color: 'from-blue-500 to-cyan-600', title: 'Inventaire intelligent', desc: 'Alertes stock bas automatiques' },
  { icon: FiTrendingUp, color: 'from-emerald-500 to-green-600', title: 'Prévisions 7 jours', desc: 'Anticipez vos besoins en stock' },
  { icon: FiShield, color: 'from-orange-500 to-amber-500', title: 'Score de crédit', desc: 'Accédez au financement facilement' },
]

const STATS = [
  { value: '500+', label: 'Commerçants' },
  { value: '24/7', label: 'Disponible' },
  { value: '3 langues', label: 'Supportées' },
]

export default function Login() {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const formatPhone = (value) => {
    // Strip non-digits
    let digits = value.replace(/[^\d+]/g, '')
    // Auto-format: 06... or 07... → 212...
    if (digits.startsWith('0') && digits.length >= 2) {
      digits = '212' + digits.slice(1)
    }
    // Remove leading + if present
    if (digits.startsWith('+')) digits = digits.slice(1)
    return digits
  }

  const displayPhone = (value) => {
    if (!value) return ''
    if (value.startsWith('212') && value.length > 3) {
      return '+212 ' + value.slice(3, 4) + ' ' + value.slice(4, 6) + ' ' + value.slice(6, 8) + ' ' + value.slice(8, 10) + ' ' + value.slice(10)
    }
    return value
  }

  const handlePhoneChange = (e) => {
    setPhone(formatPhone(e.target.value))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await authAPI.login(phone, password)
      login(data.access_token, { id: data.merchant_id, business_name: data.business_name, phone_number: phone })
      toast.success(`Bienvenue ${data.business_name}!`)
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* ── Left panel: branding ── */}
      <div className="hidden lg:flex lg:w-[52%] bg-gray-950 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/40 via-gray-950 to-indigo-900/30" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-600/10 rounded-full -translate-y-1/3 translate-x-1/3 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-600/10 rounded-full translate-y-1/3 -translate-x-1/3 blur-2xl" />

        {/* Grid overlay */}
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
          <p className="text-gray-500 text-sm mt-2 ml-0.5">Gestion Intelligente pour Commerçants Marocains</p>
        </div>

        {/* Main pitch */}
        <div className="relative z-10 space-y-6">
          <div>
            <p className="text-violet-400 text-xs font-bold tracking-widest uppercase mb-3">LA PLATEFORME N°1</p>
            <h2 className="text-white text-4xl font-black leading-tight">
              Gérez votre<br />
              commerce depuis<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">WhatsApp</span>
            </h2>
          </div>

          <div className="space-y-2.5">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-3.5 hover:bg-white/8 transition-colors">
                <div className={`w-9 h-9 bg-gradient-to-br ${f.color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg`}>
                  <f.icon className="h-4 w-4 text-white" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{f.title}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            {STATS.map(({ value, label }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <p className="text-white font-black text-lg leading-none">{value}</p>
                <p className="text-gray-500 text-xs mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: social proof */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex -space-x-2">
            {['A', 'M', 'F', 'K', 'Y'].map((l, i) => (
              <div key={l}
                className="w-8 h-8 rounded-full border-2 border-gray-950 flex items-center justify-center text-xs font-bold text-white"
                style={{ background: ['#7c3aed','#2563eb','#059669','#d97706','#dc2626'][i] }}>
                {l}
              </div>
            ))}
          </div>
          <p className="text-gray-500 text-xs">+500 commerçants font confiance à Souk.AI</p>
        </div>
      </div>

      {/* ── Right panel: form ── */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-14">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-black text-sm">S</span>
          </div>
          <span className="text-gray-900 text-xl font-black">Souk.AI</span>
        </div>

        <div className="max-w-sm w-full mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-black text-gray-900">Bon retour</h1>
            <p className="text-gray-500 text-sm mt-1.5">Connectez-vous pour gérer votre commerce</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Phone */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Numéro de téléphone</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                  <span className="text-base">🇲🇦</span>
                  <div className="w-px h-4 bg-gray-200" />
                </div>
                <input
                  type="tel"
                  required
                  value={displayPhone(phone)}
                  onChange={handlePhoneChange}
                  placeholder="0612345678"
                  className="w-full pl-14 pr-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none bg-white text-sm transition font-medium"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Format: 06XXXXXXXX ou 212XXXXXXXXX</p>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3.5 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none bg-white text-sm transition font-medium"
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

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-all shadow-xl shadow-violet-200 disabled:opacity-50 disabled:shadow-none text-sm mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Connexion en cours...
                </span>
              ) : 'Se connecter →'}
            </button>
          </form>

          {/* WhatsApp CTA */}
          <a
            href="https://wa.me/212751649010?text=سلام"
            target="_blank"
            rel="noreferrer"
            className="mt-5 flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 hover:bg-emerald-100/70 transition-colors group"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-200">
              <FiMessageSquare className="h-5 w-5 text-white" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-emerald-900">Tester le bot WhatsApp</p>
              <p className="text-xs text-emerald-600 mt-0.5">+212 751 649010 · Gratuit</p>
            </div>
            <span className="text-emerald-400 group-hover:translate-x-1 transition-transform font-bold">→</span>
          </a>

          <p className="text-center text-sm text-gray-500 mt-6">
            Pas encore de compte?{' '}
            <Link to="/register" className="text-violet-600 hover:text-violet-700 font-bold transition-colors">
              Créer un compte gratuit
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
