import { useEffect, useRef, useState } from 'react'
import { FiCamera, FiX } from 'react-icons/fi'

export default function BarcodeScanner({ onScan, onClose }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [error, setError] = useState(null)
  const [stream, setStream] = useState(null)
  const scannerRef = useRef(null)

  useEffect(() => {
    let mediaStream = null

    const startCamera = async () => {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        })
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
          setStream(mediaStream)
        }
      } catch (err) {
        setError("Impossible d'acceder a la camera. Verifiez les permissions.")
      }
    }

    startCamera()

    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop())
      }
      if (scannerRef.current) {
        clearInterval(scannerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!stream || !videoRef.current) return

    // Use BarcodeDetector API if available (Chrome 83+)
    if ('BarcodeDetector' in window) {
      const detector = new window.BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code']
      })

      scannerRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState !== 4) return
        try {
          const barcodes = await detector.detect(videoRef.current)
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue
            if (code) {
              clearInterval(scannerRef.current)
              stream.getTracks().forEach(track => track.stop())
              onScan(code)
            }
          }
        } catch {}
      }, 200)
    } else {
      setError("Scanner non supporte sur ce navigateur. Utilisez Chrome 83+ ou un navigateur recente.")
    }

    return () => {
      if (scannerRef.current) clearInterval(scannerRef.current)
    }
  }, [stream, onScan])

  const handleClose = () => {
    if (stream) stream.getTracks().forEach(track => track.stop())
    if (scannerRef.current) clearInterval(scannerRef.current)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <FiCamera className="h-4 w-4" /> Scanner code-barres
          </h3>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-xl">
            <FiX className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="relative aspect-video bg-black">
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center text-white text-sm text-center p-6">
              <div>
                <FiCamera className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>{error}</p>
                <p className="text-xs text-gray-400 mt-2">Vous pouvez entrer le code manuellement.</p>
              </div>
            </div>
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
              {/* Scan overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-32 border-2 border-red-500 rounded-lg relative">
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-500 animate-pulse" />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Manual input fallback */}
        <div className="p-4">
          <label className="block text-xs font-medium text-gray-500 mb-1">Ou entrez le code manuellement :</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ex: 6111245001234"
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                  handleClose()
                  onScan(e.target.value.trim())
                }
              }}
            />
            <button
              onClick={(e) => {
                const input = e.target.closest('.flex').querySelector('input')
                if (input?.value.trim()) {
                  handleClose()
                  onScan(input.value.trim())
                }
              }}
              className="px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
