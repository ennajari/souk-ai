import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import client from '../api/client'

function ScoreGauge({ score }) {
  const max = 1000
  const pct = Math.round((score / max) * 100)
  const color = score >= 800 ? '#22c55e' : score >= 600 ? '#f59e0b' : score >= 400 ? '#f97316' : '#ef4444'
  const label = score >= 800 ? 'Excellent' : score >= 600 ? 'Bon' : score >= 400 ? 'Moyen' : 'Faible'

  return (
    <div className="flex flex-col items-center py-6">
      <div className="relative w-44 h-44">
        <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
          <circle cx="80" cy="80" r="64" fill="none" stroke="#e5e7eb" strokeWidth="14" />
          <circle
            cx="80" cy="80" r="64" fill="none"
            stroke={color} strokeWidth="14"
            strokeDasharray={`${(pct / 100) * 402} 402`}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-black text-gray-900">{score}</span>
          <span className="text-xs text-gray-500">/ 1000</span>
        </div>
      </div>
      <span className="mt-2 text-lg font-semibold" style={{ color }}>{label}</span>
    </div>
  )
}

export default function Credit() {
  const [scoreData, setScoreData] = useState(null)
  const [offers, setOffers] = useState(null)
  const [loading, setLoading] = useState(true)
  const [requestingIdx, setRequestingIdx] = useState(null)
  const [requestedOffers, setRequestedOffers] = useState(new Set())

  useEffect(() => {
    Promise.all([
      client.get('/credit/score'),
      client.get('/credit/offers'),
    ])
      .then(([scoreRes, offersRes]) => {
        setScoreData(scoreRes.data)
        setOffers(offersRes.data)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" />
    </div>
  )

  const factors = scoreData?.factors || {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Score de Crédit</h1>
        <p className="text-sm text-gray-500 mt-1">Votre score est calculé automatiquement selon votre activité commerciale</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Votre score</h2>
          {scoreData && <ScoreGauge score={scoreData.score} />}

          {/* Factors breakdown */}
          <div className="mt-4 space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Détail des points</h3>
            {[
              { label: 'Volume des ventes (30j)', key: 'volume_points', max: 200, total_key: 'total_sales_30d', unit: 'MAD' },
              { label: 'Régularité (jours actifs)', key: 'consistency_points', max: 200, total_key: 'active_days_30d', unit: 'j' },
              { label: 'Ancienneté', key: 'history_points', max: 100, total_key: 'days_on_platform', unit: 'j' },
            ].map(f => (
              <div key={f.key}>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{f.label}</span>
                  <span className="font-semibold text-brand-700">+{factors[f.key] || 0} pts</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-brand-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, ((factors[f.key] || 0) / f.max) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {factors[f.total_key] !== undefined
                    ? `${typeof factors[f.total_key] === 'number' ? factors[f.total_key].toFixed(f.unit === 'MAD' ? 2 : 0) : factors[f.total_key]} ${f.unit}`
                    : ''}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Loan offers */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Offres de financement</h2>
          {!offers?.eligibility ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-4xl mb-3">🔒</p>
              <p className="font-medium">Score insuffisant</p>
              <p className="text-sm mt-1">Atteignez 600 points pour débloquer les offres de crédit.</p>
              <div className="mt-4 bg-gray-50 rounded-lg p-4 text-left text-sm space-y-2">
                <p className="font-medium text-gray-700">Comment améliorer votre score :</p>
                <ul className="space-y-1 text-gray-600">
                  <li>• Enregistrez toutes vos ventes via WhatsApp</li>
                  <li>• Soyez actif chaque jour</li>
                  <li>• Maintenez votre inventaire à jour</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-green-600 font-medium">✓ Vous êtes éligible au financement</p>
              {offers.offers.map((offer, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-4 hover:border-brand-300 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xl font-bold text-gray-900">{offer.amount.toLocaleString()} MAD</p>
                      <p className="text-sm text-gray-500 mt-0.5">Durée: {offer.term_days} jours</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-brand-600">{offer.fee_percentage}% de frais</p>
                      <p className="text-xs text-gray-500">
                        Remboursement: {(offer.amount * (1 + offer.fee_percentage / 100)).toFixed(0)} MAD
                      </p>
                    </div>
                  </div>
                  <button
                    disabled={requestingIdx === i || requestedOffers.has(i)}
                    className={`mt-3 w-full py-2 text-white text-sm rounded-lg font-medium ${
                      requestedOffers.has(i)
                        ? 'bg-green-500 cursor-not-allowed'
                        : requestingIdx === i
                          ? 'bg-brand-400 cursor-wait'
                          : 'bg-brand-600 hover:bg-brand-700'
                    }`}
                    onClick={async () => {
                      setRequestingIdx(i)
                      try {
                        await client.post('/credit/request', {
                          amount: offer.amount,
                          term_days: offer.term_days,
                          fee_percentage: offer.fee_percentage,
                        })
                        toast.success('Demande de financement envoyee avec succes !')
                        setRequestedOffers(prev => new Set([...prev, i]))
                      } catch (err) {
                        const detail = err.response?.data?.detail || 'Erreur lors de la demande'
                        toast.error(detail)
                      } finally {
                        setRequestingIdx(null)
                      }
                    }}
                  >
                    {requestedOffers.has(i) ? 'Demande envoyee ✓' : requestingIdx === i ? 'Envoi en cours...' : 'Demander ce financement'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="bg-gradient-to-r from-brand-50 to-brand-100 border border-brand-100 rounded-xl p-6">
        <h3 className="font-semibold text-gray-800 mb-3">Comment fonctionne le score ?</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-600">
          <div>
            <p className="font-medium text-gray-800">📊 Volume (200 pts)</p>
            <p className="mt-1">1 pt par 100 MAD de ventes sur 30 jours. Max 20 000 MAD.</p>
          </div>
          <div>
            <p className="font-medium text-gray-800">📅 Régularité (200 pts)</p>
            <p className="mt-1">~6,6 pts par jour actif. Vendez chaque jour pour maximiser.</p>
          </div>
          <div>
            <p className="font-medium text-gray-800">🕐 Ancienneté (100 pts)</p>
            <p className="mt-1">1 pt par jour sur la plateforme. Max 100 jours.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
