import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FiMoon, FiSun, FiTrendingUp, FiX } from 'react-icons/fi'

// Hijri calendar approximation for Ramadan detection
// Ramadan 2026: ~Feb 18 - Mar 19 (approx)
// Ramadan 2027: ~Feb 8 - Mar 9 (approx)
// We use a simple calculation based on known Ramadan dates
const RAMADAN_DATES = [
  { year: 2025, start: new Date(2025, 2, 1), end: new Date(2025, 2, 30) },   // Mar 1-30, 2025
  { year: 2026, start: new Date(2026, 1, 18), end: new Date(2026, 2, 19) },  // Feb 18 - Mar 19, 2026
  { year: 2027, start: new Date(2027, 1, 8), end: new Date(2027, 2, 9) },    // Feb 8 - Mar 9, 2027
]

function getRamadanInfo() {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  for (const r of RAMADAN_DATES) {
    if (today >= r.start && today <= r.end) {
      const dayOfRamadan = Math.floor((today - r.start) / (1000 * 60 * 60 * 24)) + 1
      const daysLeft = Math.floor((r.end - today) / (1000 * 60 * 60 * 24))
      return { active: true, day: dayOfRamadan, daysLeft, totalDays: 30 }
    }
    // Check if Ramadan is coming within 7 days
    const daysUntil = Math.floor((r.start - today) / (1000 * 60 * 60 * 24))
    if (daysUntil > 0 && daysUntil <= 7) {
      return { active: false, upcoming: true, daysUntil }
    }
  }
  return { active: false, upcoming: false }
}

// Approximate prayer times for Morocco (Casablanca)
function getPrayerTimes() {
  const month = new Date().getMonth()
  // Simplified: varies by month
  const times = [
    { iftar: '18:20', suhoor: '05:45' }, // Jan
    { iftar: '18:40', suhoor: '05:30' }, // Feb
    { iftar: '19:00', suhoor: '05:10' }, // Mar
    { iftar: '19:20', suhoor: '04:45' }, // Apr
    { iftar: '19:45', suhoor: '04:20' }, // May
    { iftar: '20:05', suhoor: '04:10' }, // Jun
    { iftar: '20:05', suhoor: '04:20' }, // Jul
    { iftar: '19:45', suhoor: '04:35' }, // Aug
    { iftar: '19:15', suhoor: '04:50' }, // Sep
    { iftar: '18:40', suhoor: '05:10' }, // Oct
    { iftar: '18:15', suhoor: '05:30' }, // Nov
    { iftar: '18:10', suhoor: '05:45' }, // Dec
  ]
  return times[month]
}

// Seasonal demand multipliers during Ramadan
const RAMADAN_MULTIPLIERS = {
  dates: 3.5,
  milk: 2.8,
  harira: 4.0,
  chebakia: 3.0,
  beverages: 2.5,
  bread: 1.8,
  eggs: 2.0,
  cheese: 1.5,
}

// Peak hours during Ramadan
const PEAK_HOURS = [
  { period: 'pre_iftar', time: '16:00-18:30', multiplier: 2.5 },
  { period: 'post_iftar', time: '21:00-23:00', multiplier: 1.8 },
  { period: 'suhoor', time: '03:00-05:00', multiplier: 1.5 },
]

export function useRamadan() {
  const [info, setInfo] = useState(getRamadanInfo())

  useEffect(() => {
    const interval = setInterval(() => setInfo(getRamadanInfo()), 3600000) // Update hourly
    return () => clearInterval(interval)
  }, [])

  return { ...info, prayerTimes: getPrayerTimes(), multipliers: RAMADAN_MULTIPLIERS, peakHours: PEAK_HOURS }
}

export default function RamadanBanner() {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'
  const ramadan = useRamadan()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || (!ramadan.active && !ramadan.upcoming)) return null

  const tips = [
    t('ramadan.tips.dates'),
    t('ramadan.tips.harira'),
    t('ramadan.tips.beverages'),
  ]
  const currentTip = tips[new Date().getDate() % tips.length]

  if (ramadan.upcoming) {
    return (
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <FiMoon className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-800">
              {isRtl ? `رمضان بعد ${ramadan.daysUntil} أيام` : `Ramadan dans ${ramadan.daysUntil} jours`}
            </p>
            <p className="text-xs text-amber-600 mt-0.5">{currentTip}</p>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="p-1.5 hover:bg-amber-100 rounded-lg">
          <FiX className="h-4 w-4 text-amber-500" />
        </button>
      </div>
    )
  }

  const prayerTimes = getPrayerTimes()
  const progress = (ramadan.day / ramadan.totalDays) * 100

  return (
    <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 mb-6">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <FiMoon className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-800 flex items-center gap-2">
              {t('ramadan.active')}
              <span className="text-xs bg-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full">
                {isRtl ? `اليوم ${ramadan.day}` : `Jour ${ramadan.day}/30`}
              </span>
            </p>
            <p className="text-xs text-emerald-600 mt-0.5">
              {ramadan.daysLeft} {t('ramadan.daysLeft')}
            </p>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="p-1.5 hover:bg-emerald-100 rounded-lg">
          <FiX className="h-4 w-4 text-emerald-500" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-emerald-200 rounded-full h-1.5 mb-4">
        <div className="bg-emerald-600 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Iftar time */}
        <div className="bg-white/60 rounded-xl p-3 text-center">
          <FiSun className="h-4 w-4 text-orange-500 mx-auto mb-1" />
          <p className="text-xs text-gray-500">{t('ramadan.iftarTime')}</p>
          <p className="text-lg font-bold text-gray-900">{prayerTimes.iftar}</p>
        </div>

        {/* Suhoor time */}
        <div className="bg-white/60 rounded-xl p-3 text-center">
          <FiMoon className="h-4 w-4 text-indigo-500 mx-auto mb-1" />
          <p className="text-xs text-gray-500">{t('ramadan.suhoorTime')}</p>
          <p className="text-lg font-bold text-gray-900">{prayerTimes.suhoor}</p>
        </div>

        {/* Peak hours */}
        <div className="bg-white/60 rounded-xl p-3 text-center">
          <FiTrendingUp className="h-4 w-4 text-red-500 mx-auto mb-1" />
          <p className="text-xs text-gray-500">{t('ramadan.peakHours')}</p>
          <p className="text-sm font-bold text-gray-900">16:00-18:30</p>
        </div>

        {/* Seasonal tip */}
        <div className="bg-white/60 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
          <p className="text-xs text-gray-500 mb-1">{t('ramadan.seasonalTip')}</p>
          <p className="text-xs font-semibold text-emerald-700 leading-relaxed">{currentTip}</p>
        </div>
      </div>
    </div>
  )
}

export { RAMADAN_MULTIPLIERS, PEAK_HOURS, getRamadanInfo, getPrayerTimes }
