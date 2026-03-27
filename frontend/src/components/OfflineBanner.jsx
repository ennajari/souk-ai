import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { getSyncQueue, syncPendingActions } from '../utils/offlineDB'

export default function OfflineBanner() {
  const { t } = useTranslation()
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [isSyncing, setIsSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [showSynced, setShowSynced] = useState(false)

  const updatePendingCount = useCallback(async () => {
    try {
      const queue = await getSyncQueue()
      setPendingCount(queue.length)
    } catch {
      setPendingCount(0)
    }
  }, [])

  useEffect(() => {
    const handleOnline = async () => {
      setIsOffline(false)
      setIsSyncing(true)

      try {
        await syncPendingActions()
        await updatePendingCount()
      } catch {
        // sync failed silently
      }

      setIsSyncing(false)
      setShowSynced(true)
      setTimeout(() => setShowSynced(false), 3000)
    }

    const handleOffline = () => {
      setIsOffline(true)
      setShowSynced(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    updatePendingCount()

    // Poll pending count while offline
    const interval = setInterval(updatePendingCount, 5000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [updatePendingCount])

  if (!isOffline && !isSyncing && !showSynced) return null

  return (
    <div
      className={`px-4 py-2 text-center text-sm font-medium transition-colors duration-300 ${
        isOffline
          ? 'bg-yellow-500 text-white'
          : isSyncing
          ? 'bg-blue-500 text-white'
          : 'bg-green-500 text-white'
      }`}
    >
      {isOffline && (
        <span>
          {t('offline.banner')}
          {pendingCount > 0 && (
            <span className="ml-2">
              ({pendingCount} {t('offline.pending')})
            </span>
          )}
        </span>
      )}
      {isSyncing && <span>{t('offline.syncing')}</span>}
      {showSynced && !isSyncing && !isOffline && <span>{t('offline.synced')}</span>}
    </div>
  )
}
