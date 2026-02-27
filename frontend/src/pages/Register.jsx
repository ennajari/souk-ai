import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authAPI } from '../api/client'
import toast from 'react-hot-toast'

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
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await authAPI.register(form)
      login(data.access_token, { id: data.merchant_id, business_name: data.business_name, phone_number: form.phone_number })
      toast.success('Compte cree avec succes!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de l\'inscription')
    } finally {
      setLoading(false)
    }
  }

  const categories = [
    { value: 'GROCERY', label: 'Epicerie' },
    { value: 'BAKERY', label: 'Boulangerie' },
    { value: 'BUTCHER', label: 'Boucherie' },
    { value: 'PHARMACY', label: 'Pharmacie' },
    { value: 'RESTAURANT', label: 'Restaurant' },
    { value: 'MARKET', label: 'Marche' },
    { value: 'OTHER', label: 'Autre' },
  ]

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-700 px-4 py-8">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Souk.AI</h1>
          <p className="text-gray-500 mt-2">Creez votre compte</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom du commerce</label>
            <input
              name="business_name"
              required
              value={form.business_name}
              onChange={handleChange}
              placeholder="Ex: Epicerie Ahmed"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telephone</label>
            <input
              name="phone_number"
              type="tel"
              required
              value={form.phone_number}
              onChange={handleChange}
              placeholder="212612345678"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email (optionnel)</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="email@exemple.com"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
            <input
              name="password"
              type="password"
              required
              value={form.password}
              onChange={handleChange}
              placeholder="Minimum 6 caracteres"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categorie</label>
              <select
                name="business_category"
                value={form.business_category}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
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
                <option value="AR">Arabe/Darija</option>
                <option value="FR">Francais</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Inscription...' : 'Creer mon compte'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Deja un compte?{' '}
          <Link to="/login" className="text-purple-600 hover:underline font-medium">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
