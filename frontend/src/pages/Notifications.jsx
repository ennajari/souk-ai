import { useState, useEffect } from 'react'
import { FiBell, FiPackage, FiDollarSign, FiAlertTriangle, FiCheck, FiTrash2, FiInfo, FiRefreshCw } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
import { inventoryAPI, transactionsAPI } from '../api/client'
import client from '../api/client'
import toast from 'react-hot-toast'

const ICON_MAP = {
  low_stock: { icon: FiAlertTriangle, color: 'text-orange-500', bg: 'bg-orange-100' },
  sale: { icon: FiDollarSign, color: 'text-green-500', bg: 'bg-green-100' },
  system: { icon: FiInfo, color: 'text-blue-500', bg: 'bg-blue-100' },
  product: { icon: FiPackage, color: 'text-brand-500', bg: 'bg-brand-100' },
  ramadan: { icon: FiInfo, color: 'text-amber-500', bg: 'bg-amber-100' },
}

export default function Notifications() {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    loadNotifications()
  }, [])

  const loadNotifications = async () => {
    setLoading(true)
    try {
      // Try backend notifications first
      let backendNotifs = []
      try {
        const res = await client.get('/notifications/')
        backendNotifs = res.data.map(n => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          time: new Date(n.created_at),
          read: n.is_read,
          fromBackend: true,
        }))
      } catch { /* backend notifications not available yet */ }

      // Also build local notifications from inventory + transactions
      const [alertsRes, txRes] = await Promise.all([
        inventoryAPI.alerts().catch(() => ({ data: [] })),
        transactionsAPI.list(null, 20).catch(() => ({ data: [] })),
      ])

      const localNotifs = []
      const now = new Date()

      alertsRes.data.forEach((a, i) => {
        localNotifs.push({
          id: `stock-${a.id || i}`,
          type: 'low_stock',
          title: t('notifications.lowStock'),
          message: `${isRtl ? (a.product_name_ar || a.product_name_fr) : (a.product_name_fr || a.product_name_ar)}: ${a.quantity}/${a.reorder_threshold}`,
          time: now,
          read: false,
        })
      })

      txRes.data.slice(0, 10).forEach((tx) => {
        localNotifs.push({
          id: `tx-${tx.id}`,
          type: 'sale',
          title: t('notifications.sale'),
          message: `${isRtl ? (tx.product_name_ar || tx.product_name_fr || tx.product_id) : (tx.product_name_fr || tx.product_name_ar || tx.product_id)} x${tx.quantity} — ${Number(tx.total_amount).toFixed(2)} MAD`,
          time: new Date(tx.created_at),
          read: true,
        })
      })

      // Merge: backend notifs take priority, then local
      const allNotifs = [...backendNotifs, ...localNotifs]
      allNotifs.sort((a, b) => b.time - a.time)
      setNotifications(allNotifs)
    } catch {
      toast.error(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const markAllRead = async () => {
    try {
      await client.patch('/notifications/read-all').catch(() => {})
    } catch { /* ignore */ }
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    toast.success(t('notifications.markAllRead'))
  }

  const markOneRead = async (id) => {
    const notif = notifications.find(n => n.id === id)
    if (notif?.fromBackend) {
      try { await client.patch(`/notifications/${id}/read`) } catch { /* ignore */ }
    }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const removeNotif = async (id) => {
    const notif = notifications.find(n => n.id === id)
    if (notif?.fromBackend) {
      try { await client.delete(`/notifications/${id}`) } catch { /* ignore */ }
    }
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const unreadCount = notifications.filter(n => !n.read).length

  const filtered = filter === 'all' ? notifications
    : filter === 'unread' ? notifications.filter(n => !n.read)
    : notifications.filter(n => n.type === filter)

  const getTimeLabel = (date) => {
    const now = new Date()
    const diff = now - date
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return isRtl ? 'الآن' : 'maintenant'
    if (mins < 60) return `${mins}${isRtl ? 'د' : 'm'}`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}${isRtl ? 'س' : 'h'}`
    const days = Math.floor(hours / 24)
    if (days === 1) return t('notifications.yesterday')
    return `${days}${isRtl ? 'ي' : 'j'}`
  }

  const filterButtons = [
    { key: 'all', label: t('notifications.all') },
    { key: 'unread', label: t('notifications.unread') },
    { key: 'low_stock', label: t('notifications.lowStock') },
    { key: 'sale', label: t('notifications.sale') },
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{t('notifications.title')}</h1>
          {unreadCount > 0 && (
            <span className="px-2.5 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-bold">{unreadCount}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadNotifications} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors">
            <FiRefreshCw className="h-4 w-4" />
          </button>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-sm text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1.5">
              <FiCheck className="h-4 w-4" /> {t('notifications.markAllRead')}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {filterButtons.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors active:scale-95 ${
              filter === f.key ? 'bg-brand-600 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <FiBell className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">{t('notifications.empty')}</p>
            <p className="text-sm text-gray-500 mt-1">{t('notifications.emptyHint')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(notif => {
              const style = ICON_MAP[notif.type] || ICON_MAP.system
              const Icon = style.icon
              return (
                <div
                  key={notif.id}
                  onClick={() => !notif.read && markOneRead(notif.id)}
                  className={`flex items-start gap-4 px-5 py-4 transition-colors cursor-pointer ${!notif.read ? 'bg-brand-50/50 hover:bg-brand-50' : 'hover:bg-gray-50'}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${style.bg}`}>
                    <Icon className={`h-5 w-5 ${style.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-semibold ${!notif.read ? 'text-gray-900' : 'text-gray-700'}`}>{notif.title}</p>
                      {!notif.read && <span className="w-2 h-2 bg-brand-600 rounded-full flex-shrink-0" />}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5 truncate">{notif.message}</p>
                    <p className="text-xs text-gray-500 mt-1">{getTimeLabel(notif.time)}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeNotif(notif.id) }}
                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <FiTrash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
