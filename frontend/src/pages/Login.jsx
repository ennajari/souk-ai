import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authAPI } from '../api/client'
import toast from 'react-hot-toast'

const FEATURES = [
  { icon: '🤖', title: 'Bot WhatsApp IA', desc: 'Ventes en Darija, Français ou Anglais' },
  { icon: '📦', title: 'Inventaire intelligent', desc: 'Alertes stock bas automatiques' },
  { icon: '📊', title: 'Prévisions 7 jours', desc: 'Anticipez vos besoins en stock' },
  { icon: '💳', title: 'Score de crédit', desc: 'Accédez au financement facilement' },
]

export default function Login() {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

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
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-purple-700 via-purple-600 to-indigo-700 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-purple-700 font-black text-lg">S</span>
            </div>
            <span className="text-white text-2xl font-black tracking-tight">Souk.AI</span>
          </div>
          <p className="text-purple-200 text-sm mt-2">Gestion Intelligente pour Commerçants Marocains</p>
        </div>

        <div className="relative z-10 space-y-5">
          <h2 className="text-white text-3xl font-bold leading-snug">
            Gérez votre commerce<br />
            <span className="text-yellow-300">depuis WhatsApp</span>
          </h2>
          <div className="space-y-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-center gap-3 bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/10">
                <span className="text-2xl">{f.icon}</span>
                <div>
                  <p className="text-white font-semibold text-sm">{f.title}</p>
                  <p className="text-purple-200 text-xs">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex -space-x-2">
            {['A', 'M', 'F', 'K'].map((l) => (
              <div key={l} className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-300 to-orange-400 border-2 border-white flex items-center justify-center text-xs font-bold text-white">
                {l}
              </div>
            ))}
          </div>
          <p className="text-purple-200 text-xs">+500 commerçants utilisent Souk.AI</p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-16 bg-gray-50">
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-black">S</span>
          </div>
          <span className="text-gray-900 text-xl font-black">Souk.AI</span>
        </div>

        <div className="max-w-sm w-full mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">Bon retour 👋</h1>
          <p className="text-gray-500 text-sm mt-1">Connectez-vous pour gérer votre commerce</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Numéro de téléphone</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">🇲🇦</span>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="212612345678"
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white text-sm transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white text-sm transition"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-200 disabled:opacity-50 disabled:shadow-none"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Connexion...
                </span>
              ) : 'Se connecter →'}
            </button>
          </form>

          <a href="https://wa.me/212751649010?text=سلام" target="_blank" rel="noreferrer"
            className="mt-5 flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-200 hover:bg-green-100 transition-colors group">
            <span className="text-2xl">💬</span>
            <div className="flex-1">
              <p className="text-xs font-semibold text-green-800">Tester le bot WhatsApp gratuitement</p>
              <p className="text-xs text-green-600 mt-0.5">Cliquez pour ouvrir la conversation → <span className="font-bold">+212 751 649010</span></p>
            </div>
            <span className="text-green-400 group-hover:translate-x-1 transition-transform">→</span>
          </a>

          <p className="text-center text-sm text-gray-500 mt-6">
            Pas encore de compte?{' '}
            <Link to="/register" className="text-purple-600 hover:underline font-semibold">
              Créer un compte gratuit
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
