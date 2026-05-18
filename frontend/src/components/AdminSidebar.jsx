import { NavLink } from "react-router-dom"
import { useState, useEffect } from "react"
import {
  FiHome, FiUsers, FiTruck, FiCreditCard, FiDollarSign,
  FiPercent, FiBell, FiSettings, FiX, FiLogOut
} from "react-icons/fi"
import { useAuth } from "../context/AuthContext"
import { adminAPI } from "../api/client"

export default function AdminSidebar({ onClose }) {
  const { merchant, logout } = useAuth()
  const [pendingCredits, setPendingCredits] = useState(0)

  useEffect(() => {
    adminAPI.creditRequests('PENDING')
      .then(r => setPendingCredits((r.data || []).length))
      .catch(() => {})
  }, [])

  const sections = [
    {
      label: 'VUE D\'ENSEMBLE',
      links: [
        { to: "/admin", icon: FiHome, label: 'Dashboard', end: true },
      ],
    },
    {
      label: 'GESTION',
      links: [
        { to: "/admin/merchants", icon: FiUsers, label: 'Marchands' },
        { to: "/admin/cards", icon: FiCreditCard, label: 'Cartes Souk.AI' },
        { to: "/admin/payments", icon: FiDollarSign, label: 'Paiements' },
        { to: "/admin/credit-requests", icon: FiPercent, label: 'Credits', badge: pendingCredits },
      ],
    },
  ]

  return (
    <aside className="w-64 h-full flex flex-col bg-gray-950">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 pt-6 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-white font-black text-sm">S</span>
          </div>
          <div>
            <h1 className="text-white text-lg font-black tracking-tight leading-none">Souk.AI</h1>
            <p className="text-red-400 text-[10px] font-bold mt-0.5">ADMINISTRATION</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 md:hidden transition-colors">
            <FiX className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pb-4 overflow-y-auto space-y-5">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-1.5 text-[10px] font-bold text-gray-600 tracking-widest uppercase">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-red-600 text-white shadow-lg"
                        : "text-gray-400 hover:bg-white/5 hover:text-white"
                    }`
                  }
                >
                  <link.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1">{link.label}</span>
                  {link.badge > 0 && (
                    <span className="min-w-[18px] h-[18px] bg-orange-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold leading-none px-1">
                      {link.badge > 9 ? '9+' : link.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-5 space-y-1 border-t border-white/5 pt-3">
        <NavLink
          to="/admin/settings"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              isActive ? "bg-red-600 text-white shadow-lg" : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`
          }
        >
          <FiSettings className="h-4 w-4 flex-shrink-0" />
          Parametres
        </NavLink>

        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
        >
          <FiLogOut className="h-4 w-4 flex-shrink-0" />
          Deconnexion
        </button>

        <div className="flex items-center gap-2.5 px-3 py-2 mt-1">
          <div className="w-7 h-7 bg-gradient-to-br from-red-500 to-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">A</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-300 truncate leading-none">
              {merchant?.business_name || 'Admin'}
            </p>
            <p className="text-[10px] text-gray-600 mt-0.5">Fondateur</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
