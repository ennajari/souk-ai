import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FiDownload, FiX } from 'react-icons/fi'

/** "Install the app" invite: the phone becomes the till — no hardware to buy (Android/desktop Chrome, Edge). */
export default function InstallAppBanner() {
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState(null)
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem('install-dismissed') === '1' } catch { return false }
  })

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (!prompt || hidden) return null
  const dismiss = () => {
    setHidden(true)
    try { localStorage.setItem('install-dismissed', '1') } catch { /* private mode */ }
  }
  const install = async () => {
    prompt.prompt()
    await prompt.userChoice.catch(() => null)
    setPrompt(null)
  }

  return (
    <div className="flex items-center gap-3 bg-ink-900 text-white px-4 py-2.5 text-sm" role="region" aria-label={t('install.title')}>
      <FiDownload className="h-4 w-4 shrink-0 text-mint-300" aria-hidden="true" />
      <p className="flex-1 min-w-0">{t('install.text')}</p>
      <button onClick={install} className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 font-semibold whitespace-nowrap">
        {t('install.cta')}
      </button>
      <button onClick={dismiss} className="p-1.5 rounded-lg hover:bg-white/10" aria-label={t('common.close')}>
        <FiX className="h-4 w-4" />
      </button>
    </div>
  )
}
