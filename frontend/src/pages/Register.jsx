import { useEffect, useState } from 'react'
import BrandMark from '../components/BrandMark'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authAPI } from '../api/client'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import {
  FiEye, FiEyeOff, FiUser, FiPhone, FiMail, FiLock,
  FiGrid, FiGlobe, FiCheckCircle, FiShoppingBag, FiArrowRight, FiTruck
} from 'react-icons/fi'

const categories = [
  { value: 'GROCERY', icon: FiShoppingBag },
  { value: 'BAKERY', icon: FiShoppingBag },
  { value: 'BUTCHER', icon: FiShoppingBag },
  { value: 'PHARMACY', icon: FiShoppingBag },
  { value: 'RESTAURANT', icon: FiShoppingBag },
  { value: 'MARKET', icon: FiShoppingBag },
  { value: 'OTHER', icon: FiShoppingBag },
]

const BENEFITS = [
  { icon: FiCheckCircle, text: 'register.b1' },
  { icon: FiCheckCircle, text: 'register.b2' },
  { icon: FiCheckCircle, text: 'register.b3' },
  { icon: FiCheckCircle, text: 'register.b4' },
]

const SUPPORTED_LANGS = ['AR', 'FR', 'EN']
// Default country from the browser locale (fr-FR → FR); the server falls back to its DEFAULT_COUNTRY
const browserRegion = (navigator.language || '').split('-')[1]?.toUpperCase()

export default function Register() {
  const { t, i18n } = useTranslation()
  const [countries, setCountries] = useState([])
  useEffect(() => { authAPI.countries().then(r => setCountries(r.data)).catch(() => {}) }, [])
  const regionName = (code) => {
    try { return new Intl.DisplayNames([i18n.language], { type: 'region' }).of(code) } catch { return code }
  }
  const uiLang = (i18n.language || 'fr').slice(0, 2).toUpperCase()
  const [form, setForm] = useState({
    phone_number: '',
    password: '',
    business_name: '',
    email: '',
    preferred_language: SUPPORTED_LANGS.includes(uiLang) ? uiLang : 'FR',
    country_code: '',
    business_category: 'GROCERY',
    account_type: 'MERCHANT',
  })
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const browserCountry = countries.some(c => c.code === browserRegion) ? browserRegion : ''
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await authAPI.register({ ...form, country_code: form.country_code || browserCountry || undefined })
      login(data.access_token, {
        id: data.merchant_id,
        business_name: data.business_name,
        phone_number: form.phone_number,
        account_type: data.account_type || 'MERCHANT',
      })
      toast.success(t('register.created'))
      navigate(data.account_type === 'SUPPLIER' ? '/supplier-dashboard' : '/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full pl-10 pr-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none bg-gray-50 text-sm transition font-medium"

  return (
    <div className="min-h-screen flex bg-sand-100">

      {/* ── Left panel: branding ── */}
      <div className="hidden lg:flex lg:w-[45%] bg-ink-950 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-900/40 via-ink-950 to-brand-950/30" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-brand-600/10 rounded-full -translate-y-1/3 translate-x-1/3 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-brand-700/10 rounded-full translate-y-1/3 -translate-x-1/3 blur-2xl" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }} />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <BrandMark className="h-10 w-10" />
            <span className="text-white text-2xl font-black tracking-tight">Souk.AI</span>
          </div>
          <p className="text-gray-500 text-sm mt-2">{t('landing.footer.tag')}</p>
        </div>

        {/* Pitch */}
        <div className="relative z-10 space-y-6">
          <div>
            <p className="text-brand-400 text-xs font-bold tracking-widest uppercase mb-3">{t('register.eyebrow')}</p>
            <h2 className="text-white text-4xl font-black leading-tight">
              {t('register.headline1')}<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-brand-500">{t('register.headline2')}</span>
            </h2>
          </div>

          {/* Benefits */}
          <div className="space-y-3">
            {BENEFITS.map((b) => (
              <div key={b.text} className="flex items-center gap-3">
                <b.icon className="h-4 w-4 text-emerald-400 flex-shrink-0" strokeWidth={2.5} />
                <p className="text-gray-500 text-sm">{t(b.text)}</p>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: t('login.s1v'), label: t('login.s1l') },
              { value: t('login.s2v'), label: t('login.s2l') },
              { value: t('login.s3v'), label: t('login.s3l') },
            ].map(({ value, label }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <p className="text-white font-black text-xl leading-none">{value}</p>
                <p className="text-gray-500 text-xs mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Copyright */}
        <div className="relative z-10">
          <p className="text-gray-600 text-xs">
            © {new Date().getFullYear()} Souk.AI — {t('common.allRightsReserved')}.
          </p>
        </div>
      </div>

      {/* ── Right panel: form ── */}
      <div className="flex-1 flex flex-col justify-center px-6 py-10 lg:px-12 overflow-y-auto">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-6">
          <BrandMark className="h-8 w-8" />
          <span className="text-gray-900 text-xl font-black">Souk.AI</span>
        </div>

        <div className="max-w-md w-full mx-auto">
          <div className="mb-7">
            <h1 className="text-3xl font-black text-gray-900">{t('register.title')}</h1>
            <p className="text-gray-500 text-sm mt-1.5">{t('register.subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Account type selector */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('register.iAm')}</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'MERCHANT', label: t('register.merchant'), icon: FiShoppingBag, desc: t('register.merchantDesc') },
                  { value: 'SUPPLIER', label: t('register.supplier'), icon: FiTruck, desc: t('register.supplierDesc') },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm({ ...form, account_type: opt.value })}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      form.account_type === opt.value
                        ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <opt.icon className={`h-5 w-5 mb-1.5 ${form.account_type === opt.value ? 'text-brand-600' : 'text-gray-500'}`} />
                    <p className={`text-sm font-bold ${form.account_type === opt.value ? 'text-brand-700' : 'text-gray-700'}`}>{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Business name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {form.account_type === 'SUPPLIER' ? "Nom de l'entreprise" : 'Nom du commerce'}
              </label>
              <div className="relative">
                <FiShoppingBag className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  name="business_name"
                  required
                  value={form.business_name}
                  onChange={handleChange}
                  placeholder={form.account_type === 'SUPPLIER' ? t('register.supplierNamePh') : t('register.shopNamePh')}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('login.phone')}</label>
              <div className="relative">
                <FiPhone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  name="phone_number"
                  type="tel"
                  required
                  value={form.phone_number}
                  onChange={handleChange}
                  placeholder="06 12 34 56 78"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('register.email')} <span className="text-gray-500 font-normal">({t('products.optional')})</span>
              </label>
              <div className="relative">
                <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="email@example.com"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('login.password')}</label>
              <div className="relative">
                <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  required
                  value={form.password}
                  onChange={handleChange}
                  placeholder={t('register.passwordPh')}
                  minLength={8}
                  className="w-full pl-10 pr-12 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none bg-gray-50 text-sm transition font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-600 transition-colors p-1"
                >
                  {showPass ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Country: sets currency, time zone and suggested VAT rates */}
            {countries.length > 0 && (
              <div>
                <label htmlFor="country_code" className="block text-sm font-semibold text-gray-700 mb-2">{t('register.country')}</label>
                <div className="relative">
                  <FiGlobe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                  <select id="country_code" name="country_code" value={form.country_code || browserCountry} onChange={handleChange}
                    className="w-full pl-9 pr-3 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none bg-gray-50 text-sm appearance-none font-medium">
                    <option value="">{t('register.countryDefault')}</option>
                    {countries.map(c => <option key={c.code} value={c.code}>{regionName(c.code)} · {c.currency}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* Category + Language */}
            <div className={`grid ${form.account_type === 'SUPPLIER' ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
              {form.account_type !== 'SUPPLIER' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{t('settings.category')}</label>
                  <div className="relative">
                    <FiGrid className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                    <select
                      name="business_category"
                      value={form.business_category}
                      onChange={handleChange}
                      className="w-full pl-9 pr-3 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none bg-gray-50 text-sm appearance-none font-medium"
                    >
                      {categories.map((c) => (
                        <option key={c.value} value={c.value}>{t(`settings.categories.${c.value}`)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('settings.language')}</label>
                <div className="relative">
                  <FiGlobe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                  <select
                    name="preferred_language"
                    value={form.preferred_language}
                    onChange={handleChange}
                    className="w-full pl-9 pr-3 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none bg-gray-50 text-sm appearance-none font-medium"
                  >
                    <option value="AR">العربية / الدارجة</option>
                    <option value="FR">Français</option>
                    <option value="EN">English</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 text-white font-bold rounded-xl transition-all shadow-xl shadow-brand-200 disabled:opacity-50 disabled:shadow-none text-sm flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  {t('register.creating')}
                </>
              ) : (
                <>
                  {t('landing.hero.cta')}
                  <FiArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            {t('register.haveAccount')}{' '}
            <Link to="/login" className="text-brand-600 hover:text-brand-700 font-bold transition-colors">
              {t('login.signIn')}
            </Link>
          </p>

          {/* Copyright */}
          <p className="text-center text-xs text-gray-500 mt-8 border-t border-gray-100 pt-4">
            © {new Date().getFullYear()} <span className="font-semibold text-gray-500">Souk.AI</span> — {t('common.allRightsReserved')}.
          </p>
        </div>
      </div>
    </div>
  )
}
