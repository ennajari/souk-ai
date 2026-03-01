import { NavLink } from "react-router-dom"
import { FiHome, FiPackage, FiBox, FiDollarSign, FiBarChart2, FiSettings, FiTrendingUp, FiTruck, FiStar, FiX } from "react-icons/fi"

const links = [
  { to: "/dashboard", icon: FiHome, label: "Tableau de bord" },
  { to: "/products", icon: FiPackage, label: "Produits" },
  { to: "/inventory", icon: FiBox, label: "Inventaire" },
  { to: "/sales", icon: FiDollarSign, label: "Ventes" },
  { to: "/analytics", icon: FiBarChart2, label: "Analytics" },
  { to: "/forecasts", icon: FiTrendingUp, label: "Prévisions IA" },
  { to: "/suppliers", icon: FiTruck, label: "Fournisseurs" },
  { to: "/credit", icon: FiStar, label: "Crédit Score" },
  { to: "/settings", icon: FiSettings, label: "Paramètres" },
]

export default function Sidebar({ onClose }) {
  return (
    <aside className="w-64 h-full flex flex-col">
      <div className="flex flex-col flex-grow bg-gradient-to-b from-purple-700 to-indigo-800 pt-5 pb-4 overflow-y-auto">
        <div className="px-4 mb-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shadow">
                <span className="text-purple-700 font-black text-sm">S</span>
              </div>
              <h1 className="text-white text-xl font-black">Souk.AI</h1>
            </div>
            <p className="text-purple-300 text-xs mt-1 ml-9">Gestion Intelligente</p>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-purple-200 md:hidden">
              <FiX className="h-4 w-4" />
            </button>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "text-purple-100 hover:bg-white/10"
                }`
              }
            >
              <link.icon className="mr-3 h-4 w-4 flex-shrink-0" />
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 pt-4 border-t border-white/10 mt-2">
          <a href="https://wa.me/212751649010" target="_blank" rel="noreferrer"
            className="flex items-center gap-2 px-3 py-2.5 bg-green-500/20 border border-green-400/30 rounded-xl hover:bg-green-500/30 transition-colors">
            <span className="text-lg">💬</span>
            <div>
              <p className="text-xs font-semibold text-green-300">Bot WhatsApp</p>
              <p className="text-xs text-green-400/80">+212 751 649010</p>
            </div>
          </a>
        </div>
      </div>
    </aside>
  )
}
