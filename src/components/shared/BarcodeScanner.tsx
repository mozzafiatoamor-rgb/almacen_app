/**
 * BarcodeScanner — uses html5-qrcode to read EAN-13/EAN-8 barcodes
 * via the device's rear camera.
 *
 * Props:
 *   onDetected(code)  — called once when a valid barcode is decoded
 *   onClose()         — called when the user closes/cancels the scanner
 */
import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface Props {
  onDetected: (code: string) => void
  onClose:    () => void
}

const SCANNER_ID = 'mozz-barcode-scanner-div'

export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const detectedRef = useRef(false)

  useEffect(() => {
    const scanner = new Html5Qrcode(SCANNER_ID, { verbose: false })
    scannerRef.current = scanner

    scanner.start(
      { facingMode: 'environment' },      // rear camera
      {
        fps: 10,
        qrbox: { width: 280, height: 160 },
        formatsToSupport: [
          // EAN-13 and EAN-8 (numeric codes for supermarket products)
          // html5-qrcode uses Html5QrcodeSupportedFormats enum, but we
          // pass raw ints: EAN_13=4, EAN_8=5
          4, 5,
        ] as never[],
      },
      (decodedText) => {
        if (detectedRef.current) return
        detectedRef.current = true
        // Stop scanner before calling callback so camera is released
        scanner.stop().catch(() => {}).finally(() => {
          onDetected(decodedText)
        })
      },
      () => { /* scan error — keep trying */ }
    ).catch((err) => {
      console.error('BarcodeScanner start error:', err)
    })

    return () => {
      if (scanner.isScanning) {
        scanner.stop().catch(() => {})
      }
    }
  }, [onDetected])    // eslint-disable-line react-hooks/exhaustive-deps

  function handleClose() {
    const scanner = scannerRef.current
    if (scanner?.isScanning) {
      scanner.stop().catch(() => {}).finally(onClose)
    } else {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-[300] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-safe-top pt-4 pb-3 bg-black/80">
        <span className="text-white font-semibold text-sm">📷 Escanear código de barras</span>
        <button
          onClick={handleClose}
          className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center text-lg"
          aria-label="Cerrar escáner"
        >
          ✕
        </button>
      </div>

      {/* Scanner viewport */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4">
        <div
          id={SCANNER_ID}
          className="w-full max-w-sm rounded-2xl overflow-hidden"
          style={{ minHeight: 260 }}
        />

        <div className="text-white/60 text-xs text-center max-w-xs">
          Apunta la cámara al código de barras del producto.<br />
          Se leerá automáticamente (EAN-13 / EAN-8).
        </div>
      </div>

      {/* Cancel button */}
      <div className="px-4 pb-8 pb-safe-bottom">
        <button
          onClick={handleClose}
          className="w-full bg-white/10 text-white font-semibold py-3.5 rounded-2xl"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
