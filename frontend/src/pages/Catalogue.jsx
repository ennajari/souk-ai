import { useState } from 'react'
import { FiLink, FiCopy, FiCheck, FiShare2, FiExternalLink, FiShoppingBag } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Catalogue() {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'
  const { merchant } = useAuth()
  const [copied, setCopied] = useState(false)

  const baseUrl = window.location.origin
  const catalogueUrl = `${baseUrl}/catalogue/${merchant?.id}`
  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(
    `${isRtl ? 'شوف المنتجات ديالي' : 'Découvrez nos produits'} 👇\n${catalogueUrl}`
  )}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(catalogueUrl)
      setCopied(true)
      toast.success(t('catalogue.copied'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('common.error'))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
          <FiShoppingBag className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('catalogue.title')}</h1>
          <p className="text-sm text-gray-500">{t('catalogue.subtitle')}</p>
        </div>
      </div>

      {/* Link card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center">
            <FiLink className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">{t('catalogue.yourLink')}</h2>
            <p className="text-xs text-gray-400">{t('catalogue.linkHint')}</p>
          </div>
        </div>

        {/* URL display + copy */}
        <div className="flex items-center gap-2">
          <div className="flex-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-600 font-mono truncate border border-gray-100" dir="ltr">
            {catalogueUrl}
          </div>
          <button
            onClick={handleCopy}
            className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              copied
                ? 'bg-emerald-100 text-emerald-600'
                : 'bg-violet-600 text-white hover:bg-violet-700'
            }`}
          >
            {copied ? <FiCheck className="w-5 h-5" /> : <FiCopy className="w-5 h-5" />}
          </button>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <a
            href={whatsappShareUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <FiShare2 className="w-4 h-4" />
            {t('catalogue.shareWhatsApp')}
          </a>
          <a
            href={catalogueUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
          >
            <FiExternalLink className="w-4 h-4" />
            {t('catalogue.preview')}
          </a>
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
          >
            <FiCopy className="w-4 h-4" />
            {t('catalogue.copyLink')}
          </button>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-6 border border-violet-100">
        <h3 className="font-semibold text-violet-900 mb-3">{t('catalogue.tipsTitle')}</h3>
        <ul className={`space-y-2 text-sm text-violet-700 ${isRtl ? 'pr-4' : 'pl-4'}`}>
          <li className="list-disc">{t('catalogue.tip1')}</li>
          <li className="list-disc">{t('catalogue.tip2')}</li>
          <li className="list-disc">{t('catalogue.tip3')}</li>
        </ul>
      </div>
    </div>
  )
}
