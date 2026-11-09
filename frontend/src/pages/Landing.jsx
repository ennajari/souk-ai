import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  FiArrowDownCircle, FiAlertOctagon, FiClock, FiShoppingBag, FiShoppingCart, FiBookOpen, FiPackage,
  FiTrendingUp, FiTruck, FiMessageCircle, FiBarChart2, FiDownload, FiCheck, FiGlobe,
} from 'react-icons/fi'
import BrandMark from '../components/BrandMark'

const MONEY = [
  { key: 'recover', icon: FiArrowDownCircle, tone: 'bg-mint-50 text-mint-700' },
  { key: 'lost', icon: FiAlertOctagon, tone: 'bg-red-50 text-red-700' },
  { key: 'risk', icon: FiClock, tone: 'bg-amber-50 text-amber-700' },
  { key: 'missed', icon: FiShoppingBag, tone: 'bg-brand-50 text-brand-700' },
]
const FEATURE_ICONS = [FiShoppingCart, FiBookOpen, FiPackage, FiTrendingUp, FiTruck, FiMessageCircle, FiBarChart2, FiDownload]
const LANGS = ['fr', 'ar', 'en']

/**
 * Public landing page. Rule (docs/BRAND.md): no traction figure, rating or testimonial that isn't real —
 * the previous page showed "500+ merchants", "4.9/5" and quotes, including one about a loan that never existed.
 */
export default function Landing() {
  const { t, i18n } = useTranslation()
  const L = (k, o) => t(`landing.${k}`, o)
  const nextLang = LANGS[(LANGS.indexOf(i18n.language?.slice(0, 2)) + 1) % LANGS.length]
  const switchLang = () => { i18n.changeLanguage(nextLang); localStorage.setItem('i18nextLng', nextLang) }
  const features = L('features.items', { returnObjects: true })
  const faq = L('faq.items', { returnObjects: true })

  return (
    <div className="min-h-screen bg-sand-100 text-ink-900">
      <header className="sticky top-0 z-30 bg-sand-100/90 backdrop-blur border-b border-sand-300/60">
        <nav className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4" aria-label="Principal">
          <Link to="/" className="flex items-center gap-2 font-extrabold text-lg tracking-tight">
            <BrandMark className="h-8 w-8" /><span dir="ltr">Souk<span className="text-brand-600">.AI</span></span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <a href="#money" className="hover:text-ink-900">{L('nav.features')}</a>
            <a href="#how" className="hover:text-ink-900">{L('nav.how')}</a>
            <a href="#pilot" className="hover:text-ink-900">{L('nav.pilot')}</a>
            <a href="#faq" className="hover:text-ink-900">{L('nav.faq')}</a>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={switchLang} aria-label={`Language: ${nextLang.toUpperCase()}`}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-600 hover:bg-sand-200">
              <FiGlobe className="h-3.5 w-3.5" aria-hidden="true" /> {nextLang.toUpperCase()}
            </button>
            <Link to="/login" className="hidden sm:inline px-3 py-2 text-sm font-semibold text-gray-700 hover:text-ink-900">{L('nav.login')}</Link>
            <Link to="/register" className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold">{L('nav.start')}</Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-4 pt-14 pb-10 md:pt-20 grid md:grid-cols-[1.05fr_1fr] gap-10 items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-700">{L('hero.eyebrow')}</p>
            <h1 className="mt-3 text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.05]">
              {L('hero.title1')} <span className="text-brand-600">{L('hero.title2')}</span>
            </h1>
            <p className="mt-5 text-lg text-gray-600 max-w-xl">{L('hero.sub')}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/register" className="px-6 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-lg shadow-brand-600/20">{L('hero.cta')}</Link>
              <a href="#how" className="px-6 py-3.5 rounded-xl border border-sand-300 bg-white hover:border-brand-300 font-semibold text-gray-800">{L('hero.cta2')}</a>
            </div>
            <p className="mt-3 text-sm text-gray-500">{L('hero.note')}</p>
          </div>
          <div className="relative">
            <figure className="rounded-2xl overflow-hidden border border-sand-300 bg-white shadow-2xl shadow-ink-900/10">
              <div className="h-7 bg-sand-200 flex items-center gap-1.5 px-3" aria-hidden="true">
                <span className="h-2.5 w-2.5 rounded-full bg-sand-300" /><span className="h-2.5 w-2.5 rounded-full bg-sand-300" /><span className="h-2.5 w-2.5 rounded-full bg-sand-300" />
              </div>
              <img src="/landing/dashboard.jpg" alt="Tableau de bord Souk.AI : argent à récupérer, perdu, à risque" className="w-full" width="1024" height="520" />
            </figure>
            <img src="/landing/pos-mobile.jpg" alt="Caisse Souk.AI sur téléphone" width="195" height="390"
              className="hidden sm:block absolute -bottom-12 -end-4 w-36 rounded-[1.6rem] border-[6px] border-ink-900 shadow-2xl" />
          </div>
        </section>

        {/* Where the money goes */}
        <section id="money" className="max-w-6xl mx-auto px-4 pt-20 pb-14">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight max-w-2xl">{L('money.title')}</h2>
          <p className="mt-3 text-gray-600 max-w-2xl">{L('money.sub')}</p>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {MONEY.map(({ key, icon: Icon, tone }) => (
              <div key={key} className="bg-white rounded-2xl border border-sand-300/70 p-5">
                <span className={`inline-flex p-2.5 rounded-xl ${tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
                <h3 className="mt-4 font-bold text-lg">{L(`money.${key}`)}</h3>
                <p className="mt-1.5 text-sm text-gray-600">{L(`money.${key}Desc`)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="bg-white border-y border-sand-300/60">
          <div className="max-w-6xl mx-auto px-4 py-16">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">{L('how.title')}</h2>
            <ol className="mt-8 grid md:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <li key={n} className="relative rounded-2xl bg-sand-100 p-6">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white font-bold">{n}</span>
                  <h3 className="mt-4 font-bold text-lg">{L(`how.s${n}`)}</h3>
                  <p className="mt-1.5 text-sm text-gray-600">{L(`how.s${n}d`)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section className="max-w-6xl mx-auto px-4 py-16">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">{L('features.title')}</h2>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8">
            {Array.isArray(features) && features.map(([title, desc], i) => {
              const Icon = FEATURE_ICONS[i] || FiCheck
              return (
                <div key={title}>
                  <Icon className="h-6 w-6 text-brand-600" aria-hidden="true" />
                  <h3 className="mt-3 font-bold">{title}</h3>
                  <p className="mt-1 text-sm text-gray-600">{desc}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* Pilot — honest call instead of invented traction */}
        <section id="pilot" className="max-w-6xl mx-auto px-4 pb-16">
          <div className="rounded-3xl bg-ink-950 text-white p-8 md:p-12 grid md:grid-cols-[1.4fr_1fr] gap-8 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">{L('pilot.title')}</h2>
              <p className="mt-4 text-gray-300 max-w-xl">{L('pilot.sub')}</p>
            </div>
            <div>
              <ul className="space-y-2.5">
                {['b1', 'b2', 'b3'].map((k) => (
                  <li key={k} className="flex items-center gap-2.5 text-gray-100">
                    <FiCheck className="h-5 w-5 text-mint-300 shrink-0" aria-hidden="true" /> {L(`pilot.${k}`)}
                  </li>
                ))}
              </ul>
              <Link to="/register" className="mt-6 inline-block px-6 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold">{L('pilot.cta')}</Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="max-w-3xl mx-auto px-4 pb-20">
          <h2 className="text-3xl font-extrabold tracking-tight">{L('faq.title')}</h2>
          <div className="mt-6 divide-y divide-sand-300 border-y border-sand-300">
            {Array.isArray(faq) && faq.map(([q, a]) => (
              <details key={q} className="group py-4">
                <summary className="cursor-pointer list-none flex justify-between items-center font-semibold">
                  {q}<span className="ms-4 text-brand-600 transition group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="mt-2 text-gray-600">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-sand-300/60">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center text-sm text-gray-500">
          <span className="flex items-center gap-2"><BrandMark className="h-6 w-6" /> {L('footer.tag')}</span>
          <span>© {new Date().getFullYear()} Souk.AI · {L('footer.rights')}</span>
        </div>
      </footer>
    </div>
  )
}
