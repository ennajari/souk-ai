import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Sidebar from './Sidebar'
import Header from './Header'
import OfflineBanner from './OfflineBanner'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'

  useEffect(() => {
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr'
    document.documentElement.lang = i18n.language
  }, [isRtl, i18n.language])

  return (
    <div className={`flex h-screen bg-sand-100 overflow-hidden ${isRtl ? 'flex-row-reverse' : ''}`}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 z-30 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
        ${isRtl ? 'right-0' : 'left-0'}
        ${sidebarOpen ? 'translate-x-0' : (isRtl ? 'translate-x-full' : '-translate-x-full')}
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <OfflineBanner />
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
