import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { FiShoppingBag, FiPhone, FiPackage } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
import { formatMoney } from '../utils/money'

const API_URL = import.meta.env.VITE_API_URL || '/api/v1'


export default function CataloguePublic() {
  const { t, i18n } = useTranslation()
  const { merchantId } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch(`${API_URL}/catalogue/${merchantId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('Commerce introuvable')
        return r.json()
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [merchantId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <FiShoppingBag className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">{error}</p>
        </div>
      </div>
    )
  }

  const filtered = data.products.filter(
    (p) =>
      (p.name_fr || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.name_ar || '').includes(search)
  )

  const whatsappLink = `https://wa.me/${(data.phone || '').replace(/[^0-9]/g, '')}`

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-600 to-brand-700 text-white px-4 py-8 text-center">
        <div className="w-16 h-16 bg-white/20 rounded-2xl mx-auto mb-3 flex items-center justify-center">
          <FiShoppingBag className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold">{data.business_name}</h1>
        <p className="text-brand-200 text-sm mt-1">{t(`settings.categories.${data.category || 'OTHER'}`, { defaultValue: data.category })}</p>
        <a
          href={whatsappLink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 rounded-full text-sm font-medium transition-colors"
        >
          <FiPhone className="w-4 h-4" />
          {t('catalogPublic.orderWhatsApp')}
        </a>
      </div>

      {/* Search */}
      <div className="max-w-2xl mx-auto px-4 -mt-5">
        <input
          type="text"
          placeholder={t('suppliersPage.searchProduct')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-3 bg-white rounded-xl shadow-lg border-0 focus:ring-2 focus:ring-brand-500 text-sm"
        />
      </div>

      {/* Products grid */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <p className="text-sm text-gray-500 mb-4">
          {filtered.length} produit{filtered.length !== 1 ? 's' : ''} disponible{filtered.length !== 1 ? 's' : ''}
        </p>

        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <FiPackage className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500">{t('pos.noProduct')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center mb-3">
                  <FiPackage className="w-5 h-5 text-brand-500" />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm leading-tight">{p.name_fr}</h3>
                <p className="text-xs text-gray-500 mt-0.5" dir="rtl">{p.name_ar}</p>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <span className="text-lg font-bold text-brand-600">{formatMoney(p.unit_price, data?.currency || 'MAD', i18n.language)}</span>
                    <span className="text-xs text-gray-500 ms-0.5">/ {t(`products.units.${p.unit}`, { defaultValue: p.unit })}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    p.stock > 5 ? 'bg-green-50 text-green-600' : p.stock > 0 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'
                  }`}>
                    {p.stock > 0 ? t('catalogPublic.inStock', { qty: p.stock }) : t('catalogPublic.soldOut')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-6 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          {t('catalogPublic.poweredBy')} <span className="font-semibold text-brand-500">Souk.AI</span>
        </p>
      </div>
    </div>
  )
}
