import { NavLink } from "react-router-dom"
import { useState, useEffect } from "react"
import {
  FiHome, FiPackage, FiBox, FiDollarSign, FiShoppingCart,
  FiBarChart2, FiTrendingUp, FiPercent,
  FiUsers, FiSettings, FiMessageSquare, FiX, FiTruck, FiShoppingBag
} from "react-icons/fi"
import { useAuth } from "../context/AuthContext"
import { useTranslation } from "react-i18next"
import { marketplaceAPI } from "../api/client"

export default function Sidebar({ onClose }) {
  const { merchant } = useAuth()
  const { t } = useTranslation()
  const [marketplaceBadge, setMarketplaceBadge] = useState(0)

  useEffect(() => {
    marketplaceAPI.sellingOrders()
      .then(r => {
        const pending = (r.data || []).filter(o => o.status === 'PENDING').length
        setMarketplaceBadge(pending)
      })
      .catch(() => {})
  }, [])

  const sections = [
    {
      label: t("nav.principal"),
      links: [
        { to: "/dashboard",  icon: FiHome,        label: t("nav.dashboard") },
        { to: "/products",   icon: FiPackage,     label: t("nav.products") },
        { to: "/inventory",  icon: FiBox,         label: t("nav.inventory") },
        { to: "/sales",      icon: FiDollarSign,  label: t("nav.sales") },
        { to: "/pos",        icon: FiShoppingCart,label: t("nav.pos") },
      ],
    },
    {
      label: t("nav.intelligence"),
      links: [
        { to: "/analytics", icon: FiBarChart2,  label: t("nav.analytics") },
        { to: "/profit",    icon: FiPercent,    label: t("nav.profit") },
        { to: "/forecasts", icon: FiTrendingUp, label: t("nav.forecasts") },
      ],
    },
    {
      label: t("nav.commerce"),
      links: [
        { to: "/customers",   icon: FiUsers,       label: t("nav.customers") },
        { to: "/suppliers",   icon: FiTruck,       label: t("nav.suppliers") },
        { to: "/marketplace", icon: FiShoppingBag, label: 'Marketplace B2B', badge: marketplaceBadge },
      ],
    },
  ]

  const initials = (merchant?.business_name || "S")
    .split(" ").slice(0, 2)
    .map((w) => w[0]?.toUpperCase()).join("")

  return (
    <aside className="w-64 h-full flex flex-col bg-gray-950">

      {/* ── Logo ── */}
      <div className="flex items-center justify-between px-5 pt-6 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-white font-black text-sm">S</span>
          </div>
          <div>
            <h1 className="text-white text-lg font-black tracking-tight leading-none">Souk.AI</h1>
            <p className="text-gray-500 text-[10px] font-medium mt-0.5">{t("common.smartManagement")}</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 md:hidden transition-colors">
            <FiX className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Nav ── */}
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
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-violet-600 text-white shadow-lg"
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

      {/* ── Bottom utility ── */}
      <div className="px-3 pb-5 space-y-1 border-t border-white/5 pt-3">

        {/* WhatsApp Bot */}
        <a
          href="https://wa.me/212XXXXXXXXX"
          target="_blank" rel="noreferrer"
          className="flex items-center gap-2.5 px-3 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 transition-colors"
        >
          <FiMessageSquare className="h-4 w-4 text-emerald-400 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-emerald-400 leading-none">{t("common.whatsappBot")}</p>
            <p className="text-xs text-gray-500 mt-0.5">+212 XXX XXXXXX</p>
          </div>
        </a>

        {/* Settings */}
        <NavLink
          to="/settings"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              isActive
                ? "bg-violet-600 text-white shadow-lg"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`
          }
        >
          <FiSettings className="h-4 w-4 flex-shrink-0" />
          {t("nav.settings")}
        </NavLink>

        {/* User */}
        <div className="flex items-center gap-2.5 px-3 py-2 mt-1">
          <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-300 truncate leading-none">
              {merchant?.business_name || "Commerçant"}
            </p>
            <p className="text-[10px] text-gray-600 mt-0.5 truncate">{merchant?.phone_number}</p>
          </div>
        </div>

        <div className="px-3 pt-1">
          <p className="text-[9px] text-gray-700">
            © {new Date().getFullYear()} <span className="text-gray-600 font-semibold">Souk.AI</span>
            {" · "}{t("common.allRightsReserved")}
          </p>
        </div>
      </div>
    </aside>
  )
}
