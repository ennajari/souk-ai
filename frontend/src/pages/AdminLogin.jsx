import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authAPI } from '../api/client'
import toast from 'react-hot-toast'
import { FiEye, FiEyeOff, FiShield, FiActivity, FiUsers, FiCreditCard } from 'react-icons/fi'

const FEATURES = [
  { icon: FiActivity, label: 'Monitoring en temps reel' },
  { icon: FiUsers, label: 'Gestion des marchands' },
  { icon: FiCreditCard, label: 'Suivi des cartes Souk.AI' },
  { icon: FiShield, label: 'Demandes de credit' },
]

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await authAPI.adminLogin(email, password)
      login(data.access_token, {
        id: data.merchant_id,
        business_name: data.business_name,
        is_admin: true,
        account_type: data.account_type || 'MERCHANT',
      })
      toast.success('Bienvenue, administrateur!')
      navigate('/admin')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-950">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[50%] flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-950/40 via-gray-950 to-orange-950/20" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-red-600/5 rounded-full -translate-y-1/3 translate-x-1/3 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-600/5 rounded-full translate-y-1/3 -translate-x-1/3 blur-2xl" />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-red-900/50">
              <span className="text-white font-black text-lg">S</span>
            </div>
            <div>
              <span className="text-white text-2xl font-black tracking-tight">Souk.AI</span>
              <span className="text-red-400 text-sm font-bold ml-2">Admin</span>
            </div>
          </div>
          <p className="text-gray-500 text-sm mt-2">Plateforme d'administration et d'observabilite</p>
        </div>

        {/* Features */}
        <div className="relative z-10 space-y-4">
          <p className="text-red-400 text-xs font-bold tracking-widest uppercase mb-4">TABLEAU DE BORD</p>
          <h2 className="text-white text-3xl font-black leading-tight mb-8">
            Supervisez votre<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">ecosysteme</span>
          </h2>
          {FEATURES.map(f => (
            <div key={f.label} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
                <f.icon className="h-4 w-4 text-red-400" />
              </div>
              <span className="text-gray-300 text-sm font-medium">{f.label}</span>
            </div>
          ))}
        </div>

        <div className="relative z-10">
          <p className="text-gray-600 text-xs">Espace reserve a l'administration Souk.AI</p>
        </div>
      </div>

      {/* ── Right panel: form ── */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-14 bg-gray-900">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-black text-sm">S</span>
          </div>
          <span className="text-white text-xl font-black">Souk.AI</span>
          <span className="text-red-400 text-sm font-bold ml-1">Admin</span>
        </div>

        <div className="max-w-sm w-full mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-black text-white">Administration</h1>
            <p className="text-gray-400 text-sm mt-1.5">Connectez-vous pour acceder au panneau de controle</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Adresse email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@souk-ai.com"
                className="w-full px-4 py-3.5 bg-gray-800 border border-gray-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-white text-sm transition font-medium placeholder:text-gray-500"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3.5 pr-12 bg-gray-800 border border-gray-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-white text-sm transition font-medium placeholder:text-gray-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors p-1"
                >
                  {showPass ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-bold rounded-xl transition-all shadow-xl shadow-red-900/30 disabled:opacity-50 disabled:shadow-none text-sm mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Connexion...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <FiShield className="h-4 w-4" />
                  Acceder au panneau admin
                </span>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-gray-600 mt-8 border-t border-gray-800 pt-4">
            &copy; {new Date().getFullYear()} <span className="font-semibold text-gray-500">Souk.AI</span> — Administration
          </p>
        </div>
      </div>
    </div>
  )
}
