import { FiSmartphone, FiWifi } from 'react-icons/fi'

/**
 * Carte Souk.AI visual component.
 * Props:
 * - cardNumber: string (16 digits)
 * - holderName: string
 * - balance: number
 * - cardType: "CLIENT" | "SUPPLIER" (default: "CLIENT")
 * - compact: boolean (smaller version)
 */
export default function SoukCardVisual({ cardNumber, holderName, balance, cardType = 'CLIENT', compact = false }) {
  const isSupplier = cardType === 'SUPPLIER'

  const gradient = isSupplier
    ? 'from-blue-600 via-cyan-600 to-teal-700'
    : 'from-purple-600 via-violet-600 to-indigo-700'

  const badgeColor = isSupplier
    ? 'bg-cyan-400/20 text-cyan-200'
    : 'bg-purple-400/20 text-purple-200'

  const formatted = cardNumber
    ? cardNumber.replace(/(.{4})/g, '$1 ').trim()
    : '---- ---- ---- ----'

  if (compact) {
    return (
      <div className={`bg-gradient-to-br ${gradient} rounded-xl p-3 text-white relative overflow-hidden`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold tracking-widest opacity-80">SOUK.AI</span>
            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${badgeColor}`}>
              {isSupplier ? 'FOURNISSEUR' : 'CLIENT'}
            </span>
          </div>
          <FiWifi className="h-3 w-3 opacity-40 rotate-90" />
        </div>
        <p className="font-mono text-xs tracking-widest mt-1.5 opacity-90">{formatted}</p>
        <div className="flex justify-between items-end mt-1.5">
          <p className="text-[10px] font-medium opacity-80 truncate max-w-[60%]">{holderName}</p>
          <p className="font-bold text-sm">{Number(balance || 0).toFixed(2)} <span className="text-[8px]">MAD</span></p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-gradient-to-br ${gradient} rounded-2xl p-5 text-white relative overflow-hidden`}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-8 -mb-8" />

      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-widest opacity-80">SOUK.AI</span>
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
            {isSupplier ? 'FOURNISSEUR' : 'CLIENT'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <FiWifi className="h-4 w-4 opacity-40 rotate-90" />
          <FiSmartphone className="h-5 w-5 opacity-60" />
        </div>
      </div>

      <p className="font-mono text-lg tracking-[0.25em] mb-3 relative z-10">
        {formatted}
      </p>

      <div className="flex justify-between items-end relative z-10">
        <div>
          <p className="text-[10px] uppercase tracking-wider opacity-60">Titulaire</p>
          <p className="font-bold text-sm">{holderName}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider opacity-60">Solde</p>
          <p className="font-black text-xl">{Number(balance || 0).toFixed(2)} <span className="text-xs">MAD</span></p>
        </div>
      </div>
    </div>
  )
}
