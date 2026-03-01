import { useState, useEffect } from 'react'
import { FiLogOut, FiUser, FiBell, FiMenu } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { inventoryAPI } from '../api/client'

export default function Header({ onMenuClick }) {
  const { merchant, logout } = useAuth()
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState([])
  const [showAlerts, setShowAlerts] = useState(false)

  useEffect(() => {
    inventoryAPI.alerts().then(r => setAlerts(r.data)).catch(() => {})
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="md:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <FiMenu className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-base font-semibold text-gray-800 leading-tight">
            {merchant?.business_name || 'Tableau de bord'}
          </h2>
          <p className="text-xs text-gray-400 hidden sm:block">
            {new Date().toLocaleDateString('fr-MA', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <a
          href="https://wa.me/212751649010"
          target="_blank"
          rel="noreferrer"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium border border-green-200 hover:bg-green-100 transition-colors"
        >
          <span>💬</span>
          <span>Bot WhatsApp</span>
        </a>

        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => setShowAlerts(!showAlerts)}
            className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <FiBell className="h-5 w-5" />
            {alerts.length > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">
                {alerts.length > 9 ? '9+' : alerts.length}
              </span>
            )}
          </button>

          {showAlerts && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowAlerts(false)} />
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-800">⚠️ Alertes stock bas</p>
                  <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">{alerts.length}</span>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                  {alerts.length === 0 ? (
                    <p className="text-center text-sm text-gray-400 py-6">✅ Tous les stocks sont OK</p>
                  ) : (
                    alerts.map((a) => (
                      <div key={a.id} className="flex items-center justify-between px-4 py-3 hover:bg-orange-50">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{a.product_name_ar}</p>
                          {a.product_name_fr !== a.product_name_ar && (
                            <p className="text-xs text-gray-400">{a.product_name_fr}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-red-600">{a.quantity}</span>
                          <p className="text-xs text-gray-400">seuil: {a.reorder_threshold}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {alerts.length > 0 && (
                  <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100">
                    <button
                      onClick={() => { navigate('/inventory'); setShowAlerts(false) }}
                      className="text-xs text-purple-600 hover:underline font-medium"
                    >
                      Gérer l'inventaire →
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <span className="hidden md:flex text-sm text-gray-400 items-center gap-1">
          <FiUser className="h-3.5 w-3.5" />
          {merchant?.phone_number}
        </span>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 transition-colors px-2 py-1.5 hover:bg-red-50 rounded-lg"
        >
          <FiLogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Déconnexion</span>
        </button>
      </div>
    </header>
  )
}
