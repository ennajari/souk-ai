import { FiLogOut, FiUser } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Header() {
  const { merchant, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">
          Bienvenue, {merchant?.business_name || 'Merchant'}
        </h2>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500 flex items-center gap-1">
          <FiUser className="h-4 w-4" />
          {merchant?.phone_number}
        </span>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 transition-colors"
        >
          <FiLogOut className="h-4 w-4" />
          Deconnexion
        </button>
      </div>
    </header>
  )
}
