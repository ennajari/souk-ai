import { useEffect, useRef, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL || '/api/v1'

/**
 * Hook to connect to a Server-Sent Events endpoint.
 * @param {string} path - SSE endpoint path (e.g. '/supplier-portal/events')
 * @param {Object} handlers - Map of event type → callback(data)
 * @param {boolean} enabled - Whether the connection should be active
 */
export default function useSSE(path, handlers, enabled = true) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  const reconnect = useCallback(() => {
    const token = localStorage.getItem('token')
    if (!token || !enabled) return null

    // EventSource doesn't support custom headers, pass token as query param
    const url = `${API_URL}${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
    const es = new EventSource(url)
    return es
  }, [path, enabled])

  useEffect(() => {
    if (!enabled) return

    let es = null
    let retryTimer = null

    const connect = () => {
      const token = localStorage.getItem('token')
      if (!token) return

      const url = `${API_URL}${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
      es = new EventSource(url)

      // Listen for specific event types
      const eventTypes = ['new_order', 'order_update', 'payment', 'notification']
      eventTypes.forEach(type => {
        es.addEventListener(type, (e) => {
          try {
            const data = JSON.parse(e.data)
            if (handlersRef.current[type]) {
              handlersRef.current[type](data)
            }
            // Also call generic handler
            if (handlersRef.current['*']) {
              handlersRef.current['*'](type, data)
            }
          } catch (err) {
            console.warn('[SSE] Parse error:', err)
          }
        })
      })

      es.onerror = () => {
        es.close()
        // Reconnect after 5 seconds
        retryTimer = setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      if (es) es.close()
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [path, enabled])
}

// Play a notification sound
let audioCtx = null
export function playNotificationSound() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5)
    osc.start(audioCtx.currentTime)
    osc.stop(audioCtx.currentTime + 0.5)
  } catch {
    // Audio not available
  }
}
