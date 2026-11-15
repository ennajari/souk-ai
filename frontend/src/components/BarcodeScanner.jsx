import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FiCamera, FiX, FiCheck, FiZap } from 'react-icons/fi'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'
import { validGtin } from '../utils/gtin'

// Retail symbologies only: fewer formats = faster, fewer false reads (QR/Code 39 removed)
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']
// UPC-E's check digit belongs to its expanded UPC-A form: treated like Code 128 (double read)
const CHECKSUM_FORMATS = new Set(['ean_13', 'ean_8', 'upc_a'])

let detectorPromise = null
/** Native detector when the device has one (Android Chrome: fast, ML-based); ZXing-C++ WebAssembly
 * everywhere else (iPhone Safari, Firefox, desktop) — before, those devices could not scan at all. */
function getDetector() {
  detectorPromise ??= (async () => {
    if ('BarcodeDetector' in window) {
      try {
        const supported = await window.BarcodeDetector.getSupportedFormats()
        const formats = FORMATS.filter((f) => supported.includes(f))
        if (formats.includes('ean_13')) return new window.BarcodeDetector({ formats })
      } catch { /* fall through to ZXing */ }
    }
    const { BarcodeDetector, prepareZXingModule } = await import('barcode-detector/ponyfill')
    // Self-hosted engine: works offline and sends nothing to a third-party CDN
    prepareZXingModule({ overrides: { locateFile: (path, prefix) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) } })
    return new BarcodeDetector({ formats: FORMATS })
  })()
  return detectorPromise
}

function feedback() {
  try { navigator.vibrate?.(60) } catch { /* not supported */ }
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    osc.frequency.value = 1400
    osc.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.08)
  } catch { /* audio blocked */ }
}

export default function BarcodeScanner({ onScan, onClose, continuous = false }) {
  const { t } = useTranslation()
  const videoRef = useRef(null)
  const canvasRef = useRef(document.createElement('canvas'))
  const streamRef = useRef(null)
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)
  const [torch, setTorch] = useState(null) // null = no torch on this camera
  const [lastScanned, setLastScanned] = useState(null)
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  useEffect(() => {
    let cancelled = false
    let timer = null
    let candidate = { code: null, hits: 0 }
    let pausedUntil = 0

    const stop = () => {
      clearTimeout(timer)
      streamRef.current?.getTracks().forEach((tr) => tr.stop())
    }

    const accept = (code) => {
      feedback()
      if (!continuous) {
        stop()
        onScanRef.current(code)
        return
      }
      const result = onScanRef.current(code)
      setLastScanned({ code, name: result?.name || code })
      pausedUntil = Date.now() + 1200 // same item scanned twice on purpose needs a short pause
      setTimeout(() => setLastScanned(null), 1200)
    }

    const tick = async (detector) => {
      if (cancelled) return
      const video = videoRef.current
      if (video?.readyState >= 2 && Date.now() > pausedUntil) {
        try {
          // Decode only the centre band where the reticle is: faster and fewer stray barcodes
          const w = video.videoWidth, h = video.videoHeight
          const cw = Math.round(w * 0.85), ch = Math.round(h * 0.45)
          const canvas = canvasRef.current
          canvas.width = cw
          canvas.height = ch
          canvas.getContext('2d', { willReadFrequently: true })
            .drawImage(video, (w - cw) / 2, (h - ch) / 2, cw, ch, 0, 0, cw, ch)
          const found = await detector.detect(canvas)
          const hit = found.find((b) => b.rawValue)
          if (hit) {
            const code = hit.rawValue.trim()
            if (CHECKSUM_FORMATS.has(hit.format)) {
              if (validGtin(code)) accept(code)
            } else {
              // No usable checksum (Code 128, UPC-E): require two identical reads in a row
              candidate = candidate.code === code ? { code, hits: candidate.hits + 1 } : { code, hits: 1 }
              if (candidate.hits >= 2) { candidate = { code: null, hits: 0 }; accept(code) }
            }
          }
        } catch { /* a bad frame is not an error */ }
      }
      timer = setTimeout(() => tick(detector), 120)
    }

    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
        if (cancelled) { stream.getTracks().forEach((tr) => tr.stop()); return }
        streamRef.current = stream
        const track = stream.getVideoTracks()[0]
        const caps = track.getCapabilities?.() || {}
        // Continuous autofocus where supported: small barcodes are unreadable when blurry
        if (caps.focusMode?.includes('continuous')) {
          track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {})
        }
        if (caps.torch) setTorch(false)
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
        const detector = await getDetector()
        if (cancelled) return
        setReady(true)
        tick(detector)
      } catch (e) {
        setError(e?.name === 'NotAllowedError' ? t('scanner.permission') : t('scanner.noCamera'))
      }
    })()

    return () => { cancelled = true; stop() }
  }, [continuous, t])

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch }] })
      setTorch(!torch)
    } catch { setTorch(null) }
  }

  const handleClose = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop())
    onClose()
  }

  const submitManual = (value) => {
    const code = value.trim()
    if (!code) return
    handleClose()
    onScan(code)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" role="dialog" aria-modal="true"
      aria-label={t('scanner.title')}>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <FiCamera className="h-4 w-4" aria-hidden="true" />
            {continuous ? t('scanner.continuous') : t('scanner.title')}
          </h3>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-xl" aria-label={t('common.close')}>
            <FiX className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="relative aspect-[4/3] bg-black">
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center text-white text-sm text-center p-6">
              <div>
                <FiCamera className="h-12 w-12 mx-auto mb-3 opacity-50" aria-hidden="true" />
                <p>{error}</p>
              </div>
            </div>
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className={`w-[85%] h-[45%] border-2 rounded-xl relative transition-colors ${lastScanned ? 'border-emerald-400' : 'border-white/80'}`}>
                  <div className={`absolute top-1/2 left-2 right-2 h-0.5 ${lastScanned ? 'bg-emerald-400' : 'bg-brand-500 animate-pulse'}`} />
                </div>
              </div>
              {!ready && (
                <p className="absolute top-3 inset-x-0 text-center text-xs text-white/80">{t('scanner.starting')}</p>
              )}
              {torch !== null && (
                <button onClick={toggleTorch} aria-pressed={torch} aria-label={t('scanner.torch')}
                  className={`absolute top-3 end-3 p-2.5 rounded-full ${torch ? 'bg-amber-400 text-ink-900' : 'bg-black/50 text-white'}`}>
                  <FiZap className="h-5 w-5" />
                </button>
              )}
              {lastScanned && (
                <div className="absolute bottom-0 inset-x-0 bg-emerald-600/95 text-white px-4 py-3 flex items-center gap-2" role="status">
                  <FiCheck className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  <span className="text-sm font-semibold truncate">{lastScanned.name}</span>
                  <span className="text-xs opacity-80 ms-auto">{t('scanner.added')}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-500">{t('scanner.hint')}</p>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); submitManual(e.currentTarget.code.value) }}>
            <label htmlFor="manual-code" className="sr-only">{t('scanner.manual')}</label>
            <input id="manual-code" name="code" inputMode="numeric" autoComplete="off" placeholder={t('scanner.manual')}
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
            <button className="px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700">OK</button>
          </form>
          {continuous && (
            <button onClick={handleClose} className="w-full py-2.5 bg-ink-900 text-white rounded-xl text-sm font-bold">
              {t('scanner.done')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
