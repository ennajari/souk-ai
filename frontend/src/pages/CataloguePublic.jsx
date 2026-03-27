import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { FiShoppingBag, FiPhone, FiPackage } from 'react-icons/fi'

const API_URL = import.meta.env.VITE_API_URL || '/api/v1'

const CATEGORY_LABELS = {
  GROCERY: { fr: 'Épicerie', ar: 'بقالة' },
  BAKERY: { fr: 'Boulangerie', ar: 'مخبزة' },
  BUTCHER: { fr: 'Boucherie', ar: 'جزارة' },
  PHARMACY: { fr: 'Pharmacie', ar: 'صيدلية' },
  RESTAURANT: { fr: 'Restaurant', ar: 'مطعم' },
  MARKET: { fr: 'Marché', ar: 'سوق' },
  OTHER: { fr: 'Commerce', ar: 'تجارة' },
}

const UNIT_LABELS = { piece: 'pièce', kg: 'kg', litre: 'L', carton: 'carton' }

export default function CataloguePublic() {
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
        <div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full"></div>
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

  const cat = CATEGORY_LABELS[data.category] || CATEGORY_LABELS.OTHER
  const filtered = data.products.filter(
    (p) =>
      (p.name_fr || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.name_ar || '').includes(search)
  )

  const whatsappLink = `https://wa.me/${(data.phone || '').replace(/[^0-9]/g, '')}`

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-700 text-white px-4 py-8 text-center">
        <div className="w-16 h-16 bg-white/20 rounded-2xl mx-auto mb-3 flex items-center justify-center">
          <FiShoppingBag className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold">{data.business_name}</h1>
        <p className="text-violet-200 text-sm mt-1">{cat.fr} • {cat.ar}</p>
        <a
          href={whatsappLink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 rounded-full text-sm font-medium transition-colors"
        >
          <FiPhone className="w-4 h-4" />
          Commander via WhatsApp
        </a>
      </div>

      {/* Search */}
      <div className="max-w-2xl mx-auto px-4 -mt-5">
        <input
          type="text"
          placeholder="Rechercher un produit..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-3 bg-white rounded-xl shadow-lg border-0 focus:ring-2 focus:ring-violet-500 text-sm"
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
            <p className="text-gray-400">Aucun produit trouvé</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center mb-3">
                  <FiPackage className="w-5 h-5 text-violet-500" />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm leading-tight">{p.name_fr}</h3>
                <p className="text-xs text-gray-400 mt-0.5" dir="rtl">{p.name_ar}</p>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <span className="text-lg font-bold text-violet-600">{p.unit_price}</span>
                    <span className="text-xs text-gray-400 ml-0.5">DH/{UNIT_LABELS[p.unit] || p.unit}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    p.stock > 5 ? 'bg-green-50 text-green-600' : p.stock > 0 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'
                  }`}>
                    {p.stock > 0 ? `${p.stock} en stock` : 'Épuisé'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-6 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          Propulsé par <span className="font-semibold text-violet-500">Souk.AI</span>
        </p>
      </div>
    </div>
  )
}
