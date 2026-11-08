import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import fr from './fr.json'
import ar from './ar.json'
import en from './en.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      ar: { translation: ar },
      en: { translation: en },
    },
    fallbackLng: 'fr',
    supportedLngs: ['fr', 'ar', 'en'],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
    },
  })

// Direction + lang on <html> for every page (Landing/Login too, not only the app layout)
const applyDir = (lng) => {
  document.documentElement.dir = lng?.startsWith('ar') ? 'rtl' : 'ltr'
  document.documentElement.lang = lng || 'fr'
}
applyDir(i18n.language)
i18n.on('languageChanged', applyDir)

export default i18n
