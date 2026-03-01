import { useState, useEffect } from 'react'
import { FiLogOut, FiBell, FiMenu, FiAlertTriangle } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'
import { inventoryAPI } from '../api/client'

const PAGE_TITLES = {
  '/dashboard': 'Tableau de bord',
  '/products': 'Produits',
  '/inventory': 'Inventaire',
  '/sales': 'Ventes',
  '/analytics': 'Analytics',
  '/forecasts': 'Prévisions IA',
  '/credit': 'Crédit Score',
  '/suppliers': 'Fournisseurs',
  '/settings': 'Paramètres',
}

export default function Header({ onMenuClick }) {
  const { merchant, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [alerts, setAlerts] = useState([])
  const [showAlerts, setShowAlerts] = useState(false)

  const pageTitle = PAGE_TITLES[location.pathname] || 'Souk.AI'
  const initials = (merchant?.business_name || 'S')
    .split(' ').slice(0, 2).map(w => w[0]?.toUpperCase()).join('')

  useEffect(() => {
    inventoryAPI.alerts().then(r => setAlerts(r.data)).catch(() => {})
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="bg-white border-b border-gray-100 px-4 md:px-6 h-14 flex items-center justify-between sticky top-0 z-10 shadow-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <FiMenu className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-sm font-bold text-gray-900 leading-none">{pageTitle}</h2>
          <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">
            {new Date().toLocaleDateString('fr-MA', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => setShowAlerts(!showAlerts)}
            className="relative p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <FiBell className="h-5 w-5" />
            {alerts.length > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold leading-none px-0.5">
                {alerts.length > 9 ? '9+' : alerts.length}
              </span>
            )}
          </button>

          {showAlerts && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowAlerts(false)} />
              <div className="absolute right-0 top-full mt-2 w-76 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden" style={{ width: '300px' }}>
                <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FiAlertTriangle className="h-4 w-4 text-orange-500" />
                    <p className="text-sm font-bold text-gray-900">Alertes stock</p>
                  </div>
                  {alerts.length > 0 && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">{alerts.length}</span>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                  {alerts.length === 0 ? (
                    <p className="text-center text-sm text-gray-400 py-8">Tous les stocks sont OK ✓</p>
                  ) : (
                    alerts.map((a) => (
                      <div key={a.id} className="flex items-center justify-between px-4 py-3 hover:bg-orange-50/50 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 truncate">{a.product_name_ar}</p>
                          {a.product_name_fr !== a.product_name_ar && (
                            <p className="text-xs text-gray-400 truncate">{a.product_name_fr}</p>
                          )}
                        </div>
                        <div className="text-right ml-3 flex-shrink-0">
                          <span className="text-sm font-bold text-red-600">{a.quantity}</span>
                          <p className="text-xs text-gray-400">/{a.reorder_threshold}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {alerts.length > 0 && (
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                    <button
                      onClick={() => { navigate('/inventory'); setShowAlerts(false) }}
                      className="w-full text-center text-xs text-violet-600 hover:text-violet-700 font-semibold"
                    >
                      Gérer l'inventaire →
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* User avatar + logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-gray-100">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-sm">
            <span className="text-white text-xs font-bold">{initials}</span>
          </div>
          <span className="text-sm font-medium text-gray-700 hidden md:block max-w-[120px] truncate">
            {merchant?.business_name}
          </span>
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors ml-1"
            title="Déconnexion"
          >
            <FiLogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
