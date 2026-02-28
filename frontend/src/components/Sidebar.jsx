import { NavLink } from "react-router-dom"
import { FiHome, FiPackage, FiBox, FiDollarSign, FiBarChart2, FiSettings, FiTrendingUp, FiTruck, FiStar } from "react-icons/fi"

const links = [
  { to: "/dashboard", icon: FiHome, label: "Tableau de bord" },
  { to: "/products", icon: FiPackage, label: "Produits" },
  { to: "/inventory", icon: FiBox, label: "Inventaire" },
  { to: "/sales", icon: FiDollarSign, label: "Ventes" },
  { to: "/analytics", icon: FiBarChart2, label: "Analytics" },
  { to: "/forecasts", icon: FiTrendingUp, label: "Previsions IA" },
  { to: "/suppliers", icon: FiTruck, label: "Fournisseurs" },
  { to: "/credit", icon: FiStar, label: "Credit Score" },
  { to: "/settings", icon: FiSettings, label: "Parametres" },
]

export default function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-64 md:flex-col">
      <div className="flex flex-col flex-grow bg-gradient-to-b from-purple-700 to-indigo-800 pt-5 pb-4 overflow-y-auto">
        <div className="px-4 mb-6">
          <h1 className="text-white text-2xl font-bold">Souk.AI</h1>
          <p className="text-purple-200 text-xs mt-1">Gestion Intelligente</p>
        </div>
        <nav className="flex-1 px-3 space-y-0.5">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "text-purple-100 hover:bg-white/10"
                }`
              }
            >
              <link.icon className="mr-3 h-5 w-5 flex-shrink-0" />
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  )
}
