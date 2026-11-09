import { useState, useEffect } from 'react'
import { FiLogOut, FiBell, FiMenu, FiAlertTriangle, FiCpu, FiShoppingCart, FiBarChart2 } from 'react-icons/fi'
import { RiGlobalLine } from 'react-icons/ri'
import { useAuth } from '../context/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'
import { inventoryAPI } from '../api/client'
import { useTranslation } from 'react-i18next'

const PAGE_TITLE_KEYS = {
  '/dashboard':        'nav.dashboard',
  '/products':         'nav.productsStock',
  '/inventory':        'nav.inventory',
  '/sales':            'nav.sales',
  '/pos':              'nav.pos',
  '/analytics':        'nav.analytics',
  '/profit':           'nav.profit',
  '/forecasts':        'nav.forecasts',
  '/reports':          'nav.reports',
  '/payments':         'nav.payments',
  '/customers':        'nav.customers',
  '/suppliers':        'nav.suppliers',
  '/sage-import':      'nav.sageImport',
  '/admin':            'nav.monitoring',
  '/settings':         'nav.settings',
  '/notifications':    'notifications.title',
  '/coach':            'nav.coach',
  '/employees':        'nav.employees',
  '/my-catalogue':     'nav.catalogue',
  '/marketplace':      'Marketplace B2B',
  '/payments':         'Paiements',
  '/market-intelligence': 'Intelligence Marché',
}

export default function Header({ onMenuClick }) {
  const { merchant, logout } = useAuth()
  const navigate   = useNavigate()
  const location   = useLocation()
  const { t, i18n } = useTranslation()
  const [alerts, setAlerts]         = useState([])
  const [showAlerts, setShowAlerts] = useState(false)

  const titleKey = PAGE_TITLE_KEYS[location.pathname]
  const pageTitle = titleKey ? (titleKey.startsWith('nav.') || titleKey.startsWith('notifications.') ? t(titleKey) : titleKey) : 'Souk.AI'
  const initials  = (merchant?.business_name || 'S')
    .split(' ').slice(0, 2).map(w => w[0]?.toUpperCase()).join('')

  const isAr = i18n.language === 'ar'

  // fr → ar → en → fr
  const LANGS = ['fr', 'ar', 'en']
  const nextLang = LANGS[(LANGS.indexOf(i18n.language?.slice(0, 2)) + 1) % LANGS.length]
  const toggleLang = () => {
    i18n.changeLanguage(nextLang)
    localStorage.setItem('i18nextLng', nextLang)
  }

  useEffect(() => {
    inventoryAPI.alerts().then(r => setAlerts(r.data)).catch(() => {})
  }, [])

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <header className="bg-white border-b border-gray-100 px-4 md:px-6 h-14 flex items-center justify-between sticky top-0 z-10 shadow-sm">

      {/* ── Left: menu + page title ── */}
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="md:hidden p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
          <FiMenu className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-sm font-bold text-gray-900 leading-none">{pageTitle}</h2>
          <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">
            {new Date().toLocaleDateString(i18n.language || 'fr', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* ── Right: lang + bell + user ── */}
      <div className="flex items-center gap-1.5">

        {/* Language toggle — simple pill button */}
        <button
          onClick={toggleLang}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50 text-gray-500 hover:text-brand-600 transition-all text-xs font-semibold"
          title="Changer la langue / Change language"
          aria-label={`Language: ${nextLang.toUpperCase()}`}
        >
          <RiGlobalLine className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{nextLang.toUpperCase()}</span>
        </button>

        {/* Quick modules — hidden on mobile */}
        <div className="hidden md:flex items-center gap-0.5">
          {[
            { to: '/pos',     icon: FiShoppingCart, label: t('nav.pos') },
            { to: '/reports', icon: FiBarChart2,    label: t('nav.reports') },
            { to: '/coach',   icon: FiCpu,          label: t('nav.coach') },
          ].map(({ to, icon: Icon, label }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              title={label}
              aria-label={label}
              className={`p-2 rounded-xl transition-colors ${
                location.pathname === to
                  ? 'bg-brand-100 text-brand-600'
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-600'
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>

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
              <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden" style={{ width: '300px' }}>
                <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FiAlertTriangle className="h-4 w-4 text-orange-500" />
                    <p className="text-sm font-bold text-gray-900">{t("header.stockAlerts")}</p>
                  </div>
                  {alerts.length > 0 && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">{alerts.length}</span>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                  {alerts.length === 0 ? (
                    <p className="text-center text-sm text-gray-500 py-8">{t("header.allStockOk")}</p>
                  ) : alerts.map((a) => (
                    <div key={a.id} className="flex items-center justify-between px-4 py-3 hover:bg-orange-50/50 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">{a.product_name_ar}</p>
                        {a.product_name_fr !== a.product_name_ar && (
                          <p className="text-xs text-gray-500 truncate">{a.product_name_fr}</p>
                        )}
                      </div>
                      <div className="text-right ml-3 flex-shrink-0">
                        <span className="text-sm font-bold text-red-600">{a.quantity}</span>
                        <p className="text-xs text-gray-500">/{a.reorder_threshold}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {alerts.length > 0 && (
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                    <button
                      onClick={() => { navigate('/products'); setShowAlerts(false) }}
                      className="w-full text-center text-xs text-brand-600 hover:text-brand-700 font-semibold"
                    >
                      {t("header.manageInventory")}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* User + logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-gray-100 ml-1">
          <div className="w-8 h-8 bg-gradient-to-br from-brand-600 to-brand-700 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
            <span className="text-white text-xs font-bold">{initials}</span>
          </div>
          <span className="text-sm font-medium text-gray-700 hidden md:block max-w-[120px] truncate">
            {merchant?.business_name}
          </span>
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors"
            title={t("header.logout")}
          >
            <FiLogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
