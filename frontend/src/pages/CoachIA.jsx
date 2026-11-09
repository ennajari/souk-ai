import { useState, useEffect } from 'react'
import { FiZap, FiTrendingUp, FiPackage, FiDollarSign, FiCalendar, FiRefreshCw, FiStar, FiAlertTriangle } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
import client from '../api/client'
import toast from 'react-hot-toast'

const CATEGORY_STYLE = {
  stock: { icon: FiPackage, bg: 'bg-orange-100', text: 'text-orange-600' },
  sales: { icon: FiDollarSign, bg: 'bg-green-100', text: 'text-green-600' },
  profit: { icon: FiTrendingUp, bg: 'bg-brand-100', text: 'text-brand-600' },
  seasonal: { icon: FiCalendar, bg: 'bg-blue-100', text: 'text-blue-600' },
}

const PRIORITY_BADGE = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-100 text-gray-600',
}

export default function CoachIA() {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'
  const [tips, setTips] = useState([])
  const [insights, setInsights] = useState(null)
  const [loadingTips, setLoadingTips] = useState(false)
  const [loadingInsights, setLoadingInsights] = useState(true)

  useEffect(() => {
    fetchInsights()
  }, [])

  const fetchInsights = async () => {
    setLoadingInsights(true)
    try {
      const res = await client.get('/coach/insights')
      setInsights(res.data)
    } catch {
      // Coach endpoint may not be available yet
      setInsights(null)
    } finally {
      setLoadingInsights(false)
    }
  }

  const fetchTips = async () => {
    setLoadingTips(true)
    try {
      const res = await client.get('/coach/tips')
      setTips(res.data)
    } catch {
      toast.error(t('common.error'))
    } finally {
      setLoadingTips(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center">
            <FiZap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isRtl ? 'المدرب الذكي' : 'Coach IA'}
            </h1>
            <p className="text-sm text-gray-500">
              {isRtl ? 'نصائح مخصصة بناءً على بياناتك' : 'Conseils personnalisés basés sur vos données'}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Insights */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {loadingInsights ? (
          Array(5).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
              <div className="h-6 bg-gray-200 rounded w-1/2" />
            </div>
          ))
        ) : insights ? (
          <>
            <InsightCard
              icon={FiStar} color="green"
              label={isRtl ? 'الأكثر مبيعاً' : 'Best seller'}
              value={insights.best_seller?.product || '-'}
              sub={insights.best_seller ? `${insights.best_seller.quantity_sold} ${isRtl ? 'وحدة' : 'vendus'}` : ''}
            />
            <InsightCard
              icon={FiAlertTriangle} color="red"
              label={isRtl ? 'أقل أداء' : 'Moins rentable'}
              value={insights.worst_performer?.product || '-'}
              sub={insights.worst_performer ? `${insights.worst_performer.margin_pct}%` : ''}
            />
            <InsightCard
              icon={FiCalendar} color="blue"
              label={isRtl ? 'يوم الذروة' : 'Jour de pointe'}
              value={insights.peak_day?.day || '-'}
              sub={insights.peak_day ? `${insights.peak_day.transactions} ${isRtl ? 'معاملة' : 'ventes'}` : ''}
            />
            <InsightCard
              icon={FiDollarSign} color="violet"
              label={isRtl ? 'متوسط السلة' : 'Panier moyen'}
              value={insights.avg_basket ? `${insights.avg_basket.toFixed(0)} MAD` : '-'}
            />
            <InsightCard
              icon={FiPackage} color="amber"
              label={isRtl ? 'أيام المخزون' : 'Jours de stock'}
              value={insights.stock_days?.length ? `~${Math.round(insights.stock_days.reduce((s, d) => s + d.estimated_days_left, 0) / insights.stock_days.length)}j` : '-'}
              sub={insights.stock_days?.length ? `${insights.stock_days.length} ${isRtl ? 'منتج' : 'produits'}` : ''}
            />
          </>
        ) : (
          <div className="col-span-full text-center py-8 text-gray-500 text-sm">
            {isRtl ? 'لا توجد بيانات كافية' : 'Pas assez de données'}
          </div>
        )}
      </div>

      {/* AI Tips */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b bg-gradient-to-r from-brand-50 to-brand-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiZap className="h-4 w-4 text-brand-600" />
            <h2 className="font-bold text-gray-900 text-sm">
              {isRtl ? 'نصائح ذكية' : 'Conseils IA personnalisés'}
            </h2>
          </div>
          <button
            onClick={fetchTips}
            disabled={loadingTips}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            <FiRefreshCw className={`h-4 w-4 ${loadingTips ? 'animate-spin' : ''}`} />
            {loadingTips
              ? (isRtl ? 'جاري التحليل...' : 'Analyse...')
              : (isRtl ? 'تحليل بياناتي' : 'Analyser mes données')}
          </button>
        </div>

        <div className="divide-y divide-gray-100">
          {tips.length === 0 ? (
            <div className="text-center py-12">
              <FiZap className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 font-medium">
                {isRtl ? 'اضغط على "تحليل بياناتي" للحصول على نصائح' : 'Cliquez sur "Analyser mes données" pour obtenir des conseils'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {isRtl ? 'النصائح بالدارجة والفرنسية' : 'Conseils en darija et français'}
              </p>
            </div>
          ) : tips.map((tip, i) => {
            const style = CATEGORY_STYLE[tip.category] || CATEGORY_STYLE.sales
            const Icon = style.icon
            return (
              <div key={i} className="px-6 py-4 flex items-start gap-4">
                <div className={`w-10 h-10 ${style.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`h-5 w-5 ${style.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PRIORITY_BADGE[tip.priority] || PRIORITY_BADGE.medium}`}>
                      {tip.priority === 'high' ? (isRtl ? 'مهم' : 'Important') : tip.priority === 'medium' ? (isRtl ? 'متوسط' : 'Moyen') : (isRtl ? 'عادي' : 'Normal')}
                    </span>
                    <span className="text-xs text-gray-500 capitalize">{tip.category}</span>
                  </div>
                  <p className="text-sm text-gray-800 leading-relaxed">{tip.tip}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function InsightCard({ icon: Icon, color, label, value, sub }) {
  const colors = {
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
    blue: 'bg-blue-100 text-blue-600',
    violet: 'bg-brand-100 text-brand-600',
    amber: 'bg-amber-100 text-amber-600',
  }
  const c = colors[color] || colors.violet
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className={`w-8 h-8 ${c.split(' ')[0]} rounded-lg flex items-center justify-center mb-2`}>
        <Icon className={`h-4 w-4 ${c.split(' ')[1]}`} />
      </div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-bold text-gray-900 mt-0.5 truncate">{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  )
}
