import { NavLink } from "react-router-dom"
import {
  FiHome, FiPackage, FiBox, FiDollarSign,
  FiBarChart2, FiSettings, FiTrendingUp, FiTruck, FiStar, FiX,
  FiMessageSquare, FiDatabase, FiShoppingCart, FiMonitor, FiUsers, FiPercent, FiGlobe, FiBell, FiCpu, FiUserCheck
} from "react-icons/fi"
import { useAuth } from "../context/AuthContext"
import { useTranslation } from "react-i18next"

const getSections = (t) => [
  {
    label: t("nav.principal"),
    links: [
      { to: "/dashboard", icon: FiHome, label: t("nav.dashboard") },
      { to: "/products", icon: FiPackage, label: t("nav.products") },
      { to: "/inventory", icon: FiBox, label: t("nav.inventory") },
      { to: "/sales", icon: FiDollarSign, label: t("nav.sales") },
      { to: "/pos", icon: FiShoppingCart, label: t("nav.pos") },
    ],
  },
  {
    label: t("nav.intelligence"),
    links: [
      { to: "/analytics", icon: FiBarChart2, label: t("nav.analytics") },
      { to: "/profit", icon: FiPercent, label: t("nav.profit") },
      { to: "/forecasts", icon: FiTrendingUp, label: t("nav.forecasts") },
      { to: "/credit", icon: FiStar, label: t("nav.credit") },
      { to: "/coach", icon: FiCpu, label: t("nav.coach") },
    ],
  },
  {
    label: t("nav.commerce"),
    links: [
      { to: "/customers", icon: FiUsers, label: t("nav.customers") },
      { to: "/notifications", icon: FiBell, label: t("notifications.title") },
      { to: "/my-catalogue", icon: FiShoppingCart, label: t("nav.catalogue") },
      { to: "/suppliers", icon: FiTruck, label: t("nav.suppliers") },
      { to: "/sage-import", icon: FiDatabase, label: t("nav.sageImport") },
      { to: "/employees", icon: FiUserCheck, label: t("nav.employees") },
      { to: "/admin", icon: FiMonitor, label: t("nav.monitoring") },
      { to: "/settings", icon: FiSettings, label: t("nav.settings") },
    ],
  },
]

export default function Sidebar({ onClose }) {
  const { merchant } = useAuth()
  const { t, i18n } = useTranslation()
  const sections = getSections(t)

  const toggleLang = () => {
    const newLang = i18n.language === 'ar' ? 'fr' : 'ar'
    i18n.changeLanguage(newLang)
    localStorage.setItem('i18nextLng', newLang)
  }

  const initials = (merchant?.business_name || "S")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("")

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
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 md:hidden transition-colors"
          >
            <FiX className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Nav sections ── */}
      <nav className="flex-1 px-3 pb-4 overflow-y-auto space-y-5">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-1.5 text-[10px] font-bold text-gray-600 tracking-widest">
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
                  {link.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Bottom: WhatsApp + Lang + User ── */}
      <div className="px-3 pb-5 space-y-2 border-t border-white/5 pt-3">
        <a
          href="https://wa.me/212751649010"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2.5 px-3 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 transition-colors"
        >
          <FiMessageSquare className="h-4 w-4 text-emerald-400 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-emerald-400 leading-none">{t("common.whatsappBot")}</p>
            <p className="text-xs text-gray-500 mt-0.5">+212 751 649010</p>
          </div>
        </a>

        {/* Language toggle */}
        <button
          onClick={toggleLang}
          className="flex items-center gap-2.5 px-3 py-2.5 w-full rounded-xl hover:bg-white/5 transition-colors"
        >
          <FiGlobe className="h-4 w-4 text-violet-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-gray-400">
            {i18n.language === 'ar' ? 'Français' : 'العربية'}
          </span>
        </button>

        <div className="flex items-center gap-2.5 px-3 py-2">
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

        {/* Copyright */}
        <div className="px-3 pt-1 pb-1">
          <p className="text-[9px] text-gray-700 leading-relaxed">
            © {new Date().getFullYear()} <span className="text-gray-600 font-semibold">Souk.AI</span><br />
            {t("common.allRightsReserved")}
          </p>
        </div>
      </div>
    </aside>
  )
}
