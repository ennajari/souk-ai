import { FiTrendingUp, FiTrendingDown, FiMinus } from 'react-icons/fi'

const configs = {
  purple: {
    gradient: 'bg-gradient-to-br from-violet-500 to-purple-600',
    shadow: 'hover:shadow-violet-100',
    border: 'border-violet-100',
    badge: 'bg-violet-50 text-violet-700',
  },
  green: {
    gradient: 'bg-gradient-to-br from-emerald-500 to-green-600',
    shadow: 'hover:shadow-emerald-100',
    border: 'border-emerald-100',
    badge: 'bg-emerald-50 text-emerald-700',
  },
  orange: {
    gradient: 'bg-gradient-to-br from-orange-500 to-amber-500',
    shadow: 'hover:shadow-orange-100',
    border: 'border-orange-100',
    badge: 'bg-orange-50 text-orange-700',
  },
  blue: {
    gradient: 'bg-gradient-to-br from-blue-500 to-cyan-500',
    shadow: 'hover:shadow-blue-100',
    border: 'border-blue-100',
    badge: 'bg-blue-50 text-blue-700',
  },
  red: {
    gradient: 'bg-gradient-to-br from-red-500 to-rose-500',
    shadow: 'hover:shadow-red-100',
    border: 'border-red-100',
    badge: 'bg-red-50 text-red-700',
  },
  indigo: {
    gradient: 'bg-gradient-to-br from-indigo-500 to-blue-600',
    shadow: 'hover:shadow-indigo-100',
    border: 'border-indigo-100',
    badge: 'bg-indigo-50 text-indigo-700',
  },
}

export default function StatsCard({ title, value, icon: Icon, color = 'purple', trend, trendLabel, subtitle }) {
  const c = configs[color] || configs.purple
  const isUp = trend > 0
  const isDown = trend < 0

  return (
    <div className={`bg-white rounded-2xl border ${c.border} p-4 sm:p-5 hover:shadow-lg ${c.shadow} transition-all duration-300 group`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{title}</p>
          <p className="text-2xl sm:text-3xl font-black text-gray-900 mt-1.5 truncate leading-none tabular-nums">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1 truncate">{subtitle}</p>}
          {trend !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md ${
                isUp ? 'bg-emerald-50 text-emerald-700' : isDown ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
              }`}>
                {isUp ? <FiTrendingUp className="h-3 w-3" /> : isDown ? <FiTrendingDown className="h-3 w-3" /> : <FiMinus className="h-3 w-3" />}
                {Math.abs(trend)}%
              </span>
              {trendLabel && <span className="text-xs text-gray-400">{trendLabel}</span>}
            </div>
          )}
        </div>
        <div className={`${c.gradient} p-3 rounded-2xl shadow-md group-hover:scale-110 transition-transform duration-300 flex-shrink-0`}>
          {Icon && <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" strokeWidth={2} />}
        </div>
      </div>
    </div>
  )
}
