import { Link } from "react-router-dom"
import {
  RiRobot2Line,
  RiBarChart2Line,
  RiFileTextLine,
  RiShieldCheckLine,
  RiStore2Line,
  RiLineChartLine,
  RiArrowRightLine,
  RiWhatsappLine,
  RiCheckLine,
  RiStarLine,
  RiFlashlightLine,
  RiGlobalLine,
  RiTeamLine,
  RiMenuLine,
  RiCloseLine,
} from "react-icons/ri"
import { useState, useEffect, useRef } from "react"

/* ─── DATA ─────────────────────────────────────────────────── */
const features = [
  {
    icon: RiRobot2Line,
    title: "Assistant IA WhatsApp",
    desc: "Gérez ventes, stocks et commandes par message vocal en Darija, Français ou Tamazight. Zero formation requise.",
    color: "from-fuchsia-500 to-violet-600",
    glow: "shadow-fuchsia-500/20",
  },
  {
    icon: RiStore2Line,
    title: "Inventaire en temps réel",
    desc: "Alertes automatiques de rupture de stock. Suivi instantané de chaque produit, à tout moment.",
    color: "from-violet-500 to-indigo-600",
    glow: "shadow-violet-500/20",
  },
  {
    icon: RiLineChartLine,
    title: "Prévisions de demande",
    desc: "Anticipez vos besoins de réapprovisionnement grâce à l'analyse statistique avancée sur 7 jours.",
    color: "from-cyan-500 to-blue-600",
    glow: "shadow-cyan-500/20",
  },
  {
    icon: RiShieldCheckLine,
    title: "Score de crédit",
    desc: "Obtenez un score de crédit bancable basé sur vos données réelles de vente — accédez au financement.",
    color: "from-emerald-500 to-teal-600",
    glow: "shadow-emerald-500/20",
  },
  {
    icon: RiFileTextLine,
    title: "Factures PDF instantanées",
    desc: "Générez et envoyez des factures professionnelles en quelques secondes directement via WhatsApp.",
    color: "from-orange-500 to-amber-600",
    glow: "shadow-orange-500/20",
  },
  {
    icon: RiGlobalLine,
    title: "Catalogue en ligne",
    desc: "Partagez votre catalogue produits avec vos clients via un lien personnalisé — vendez en ligne sans effort.",
    color: "from-pink-500 to-rose-600",
    glow: "shadow-pink-500/20",
  },
]

const stats = [
  { value: "500+", label: "Commerçants actifs", icon: RiTeamLine },
  { value: "24/7", label: "Disponibilité", icon: RiFlashlightLine },
  { value: "3", label: "Langues", icon: RiGlobalLine },
  { value: "90%", label: "Ventes en < 30s", icon: RiBarChart2Line },
]

const steps = [
  {
    num: "01",
    title: "Créez votre compte",
    desc: "Inscription gratuite en 2 minutes. Aucune carte bancaire requise.",
    icon: RiStore2Line,
  },
  {
    num: "02",
    title: "Connectez WhatsApp",
    desc: "Liez votre numéro professionnel. Le bot est opérationnel en 30 secondes.",
    icon: RiWhatsappLine,
  },
  {
    num: "03",
    title: "Gérez par la voix",
    desc: "Envoyez un message vocal — le bot enregistre la vente, met à jour le stock, génère la facture.",
    icon: RiRobot2Line,
  },
]

const testimonials = [
  {
    name: "Hassan B.",
    role: "Épicerie, Casablanca",
    text: "Avant Souk.AI, je perdais 2 heures par jour sur les comptes. Maintenant je gère tout en vocal depuis mon téléphone.",
    rating: 5,
  },
  {
    name: "Fatima Z.",
    role: "Boutique textile, Fès",
    text: "Le bot répond en Darija, c'est exactement ce qu'il me fallait. Mes commandes fournisseurs se font automatiquement.",
    rating: 5,
  },
  {
    name: "Youssef M.",
    role: "Quincaillerie, Marrakech",
    text: "Le score de crédit m'a permis d'obtenir un financement. Je n'y croyais pas au début.",
    rating: 5,
  },
]

/* ─── COMPONENTS ────────────────────────────────────────────── */
function GradientOrb({ className }) {
  return (
    <div className={`absolute rounded-full blur-3xl pointer-events-none opacity-30 ${className}`} />
  )
}

function AnimatedCounter({ target, suffix = "" }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const started = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          const numeric = parseInt(target.replace(/\D/g, "")) || 0
          if (numeric === 0) { setCount(target); return }
          let start = 0
          const step = Math.ceil(numeric / 40)
          const timer = setInterval(() => {
            start += step
            if (start >= numeric) { setCount(numeric); clearInterval(timer) }
            else setCount(start)
          }, 30)
        }
      },
      { threshold: 0.5 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target])

  return (
    <span ref={ref}>
      {typeof count === "number" ? count + suffix : count}
    </span>
  )
}

/* ─── MAIN ──────────────────────────────────────────────────── */
export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-[#050508] text-white font-sans overflow-x-hidden">

      {/* ── NOISE TEXTURE overlay ── */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* ══════════════════════════════════════
          NAV
      ══════════════════════════════════════ */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-[#050508]/90 backdrop-blur-xl border-b border-white/[0.06]"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center shadow-lg shadow-fuchsia-500/30">
              <RiStore2Line className="text-white text-sm" />
            </div>
            <span className="text-xl font-black bg-gradient-to-r from-fuchsia-400 via-violet-300 to-cyan-400 bg-clip-text text-transparent">
              Souk.AI
            </span>
          </div>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
            {["Fonctionnalités", "Comment ça marche", "Témoignages", "Contact"].map((l, i) => (
              <a
                key={l}
                href={["#features", "#how", "#testimonials", "#contact"][i]}
                className="hover:text-white transition-colors duration-200 relative group"
              >
                {l}
                <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-gradient-to-r from-fuchsia-400 to-cyan-400 group-hover:w-full transition-all duration-300" />
              </a>
            ))}
          </div>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm text-gray-300 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/5"
            >
              Connexion
            </Link>
            <Link
              to="/register"
              className="text-sm bg-gradient-to-r from-fuchsia-500 to-violet-600 hover:from-fuchsia-400 hover:to-violet-500 text-white px-5 py-2.5 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-fuchsia-500/20 hover:shadow-fuchsia-500/40 flex items-center gap-2"
            >
              Essai gratuit
              <RiArrowRightLine className="text-base" />
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-gray-300 hover:text-white p-2"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <RiCloseLine className="text-2xl" /> : <RiMenuLine className="text-2xl" />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-[#0a0a12]/95 backdrop-blur-xl border-b border-white/[0.06] px-6 py-4 flex flex-col gap-4">
            {["Fonctionnalités", "Comment ça marche", "Contact"].map((l, i) => (
              <a
                key={l}
                href={["#features", "#how", "#contact"][i]}
                className="text-gray-300 hover:text-white text-sm py-2"
                onClick={() => setMenuOpen(false)}
              >
                {l}
              </a>
            ))}
            <div className="flex gap-3 pt-2 border-t border-white/[0.06]">
              <Link to="/login" className="flex-1 text-center text-sm border border-white/10 rounded-xl py-2.5 text-gray-300 hover:text-white hover:border-white/30 transition-all">
                Connexion
              </Link>
              <Link to="/register" className="flex-1 text-center text-sm bg-gradient-to-r from-fuchsia-500 to-violet-600 rounded-xl py-2.5 text-white font-semibold">
                Essai gratuit
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ══════════════════════════════════════
          HERO
      ══════════════════════════════════════ */}
      <section className="relative pt-36 pb-28 px-6 overflow-hidden">
        {/* Orbs */}
        <GradientOrb className="w-[700px] h-[700px] bg-fuchsia-600 -top-40 -left-40" />
        <GradientOrb className="w-[500px] h-[500px] bg-violet-700 top-20 right-0" />
        <GradientOrb className="w-[400px] h-[400px] bg-cyan-600 bottom-0 left-1/3" />

        {/* Grid lines */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />

        <div className="relative max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/[0.1] rounded-full px-5 py-2 mb-8 text-xs font-semibold text-fuchsia-300 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse" />
            L'IA pour le commerce marocain · 2026
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-black leading-[1.05] tracking-tight mb-6">
            <span className="text-white">Gérez votre commerce</span>
            <br />
            <span
              className="bg-gradient-to-r from-fuchsia-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent"
              style={{ WebkitTextStroke: "0px" }}
            >
              par WhatsApp
            </span>
            <br />
            <span className="text-white">en Darija</span>
          </h1>

          {/* Sub */}
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Souk.AI est l'assistant intelligent qui permet aux commerçants marocains
            de gérer inventaire, ventes et factures par message vocal —
            <span className="text-gray-200"> sans formation, sans ordinateur.</span>
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to="/register"
              className="group relative inline-flex items-center gap-3 bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 shadow-2xl shadow-fuchsia-500/30 hover:shadow-fuchsia-500/50 hover:scale-[1.02]"
            >
              <span>Commencer gratuitement</span>
              <RiArrowRightLine className="text-xl group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="https://wa.me/212XXXXXXXXX"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-white/[0.04] border border-white/[0.1] hover:border-white/[0.25] hover:bg-white/[0.08] text-white px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-300"
            >
              <RiWhatsappLine className="text-2xl text-emerald-400" />
              <span>Voir la démo</span>
            </a>
          </div>

          {/* Social proof */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {["bg-fuchsia-500", "bg-violet-500", "bg-cyan-500", "bg-emerald-500"].map((c) => (
                  <div key={c} className={`w-7 h-7 rounded-full ${c} border-2 border-[#050508]`} />
                ))}
              </div>
              <span>500+ commerçants actifs</span>
            </div>
            <div className="flex items-center gap-1.5">
              {[1,2,3,4,5].map((i) => (
                <RiStarLine key={i} className="text-amber-400 text-base fill-amber-400" style={{ fill: "#f59e0b" }} />
              ))}
              <span className="ml-1">4.9/5</span>
            </div>
            <div className="flex items-center gap-1.5">
              <RiCheckLine className="text-emerald-400 text-base" />
              <span>Aucune carte bancaire requise</span>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          STATS BAR
      ══════════════════════════════════════ */}
      <section className="relative py-14 border-y border-white/[0.05]">
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: "linear-gradient(to right, #a855f7, #22d3ee)",
          }}
        />
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map(({ value, label, icon: Icon }) => (
            <div key={label} className="text-center group">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] mb-4 mx-auto group-hover:border-fuchsia-500/40 transition-colors">
                <Icon className="text-fuchsia-400 text-xl" />
              </div>
              <div className="text-4xl md:text-5xl font-black bg-gradient-to-r from-fuchsia-400 to-cyan-400 bg-clip-text text-transparent tabular-nums">
                {value === "24/7" || value === "3" ? value : (
                  <AnimatedCounter
                    target={value}
                    suffix={value.includes("+") ? "+" : value.includes("%") ? "%" : ""}
                  />
                )}
              </div>
              <div className="text-sm text-gray-500 mt-1 font-medium">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════
          FEATURES
      ══════════════════════════════════════ */}
      <section id="features" className="py-28 px-6 relative">
        <GradientOrb className="w-[600px] h-[600px] bg-violet-700 top-0 right-0 opacity-20" />

        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <span className="inline-block text-xs font-bold text-violet-400 uppercase tracking-widest mb-4 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5">
              Fonctionnalités
            </span>
            <h2 className="text-4xl md:text-5xl font-black mb-5">
              Tout ce dont vous avez besoin,
              <br />
              <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                en un seul outil
              </span>
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto text-lg">
              Conçu spécifiquement pour la réalité des TPE marocaines.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, idx) => {
              const Icon = f.icon
              return (
                <div
                  key={f.title}
                  className="relative group bg-white/[0.02] border border-white/[0.06] rounded-3xl p-7 hover:border-white/[0.15] hover:bg-white/[0.04] transition-all duration-500 overflow-hidden"
                >
                  {/* Background glow on hover */}
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${f.color} rounded-3xl blur-2xl`} style={{ opacity: 0 }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.05'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0'}
                  />

                  {/* Number */}
                  <div className="absolute top-6 right-6 text-xs font-bold text-white/10 tabular-nums">
                    {String(idx + 1).padStart(2, "0")}
                  </div>

                  {/* Icon */}
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br ${f.color} mb-5 shadow-xl ${f.glow}`}>
                    <Icon className="text-white text-xl" />
                  </div>

                  <h3 className="font-bold text-white text-lg mb-2.5">{f.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>

                  {/* Bottom line accent */}
                  <div className={`absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r ${f.color} opacity-0 group-hover:opacity-40 transition-opacity duration-500`} />
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════ */}
      <section id="how" className="py-28 px-6 relative">
        <GradientOrb className="w-[500px] h-[500px] bg-cyan-700 bottom-0 left-0 opacity-15" />

        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20">
            <span className="inline-block text-xs font-bold text-cyan-400 uppercase tracking-widest mb-4 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-4 py-1.5">
              Comment ça marche
            </span>
            <h2 className="text-4xl md:text-5xl font-black mb-5">
              Opérationnel en{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                5 minutes
              </span>
            </h2>
            <p className="text-gray-500 text-lg">Aucune formation requise, zéro installation.</p>
          </div>

          <div className="relative">
            {/* Connector line */}
            <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[2px] h-[calc(100%-5rem)] bg-gradient-to-b from-fuchsia-500/30 via-violet-500/30 to-cyan-500/30 hidden md:block" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              {steps.map((s, i) => {
                const Icon = s.icon
                return (
                  <div key={s.num} className="flex flex-col items-center text-center group">
                    {/* Step number ring */}
                    <div className="relative mb-6">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-violet-600/20 border border-fuchsia-500/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-xl shadow-fuchsia-500/10">
                        <Icon className="text-fuchsia-400 text-2xl" />
                      </div>
                      <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center text-xs font-black text-white">
                        {i + 1}
                      </div>
                    </div>
                    <div className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">
                      Étape {s.num}
                    </div>
                    <h3 className="font-black text-xl text-white mb-3">{s.title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════ */}
      <section id="testimonials" className="py-28 px-6 relative">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <span className="inline-block text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5">
              Témoignages
            </span>
            <h2 className="text-4xl md:text-5xl font-black mb-5">
              Ils font confiance à{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                Souk.AI
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="bg-white/[0.02] border border-white/[0.06] rounded-3xl p-7 hover:border-white/[0.12] transition-all duration-300 group"
              >
                {/* Stars */}
                <div className="flex gap-1 mb-5">
                  {Array(t.rating).fill(0).map((_, i) => (
                    <RiStarLine
                      key={i}
                      className="text-amber-400 text-base"
                      style={{ fill: "#f59e0b" }}
                    />
                  ))}
                </div>
                <p className="text-gray-300 text-sm leading-relaxed mb-6 italic">
                  "{t.text}"
                </p>
                <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center text-xs font-black text-white">
                    {t.name[0]}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{t.name}</div>
                    <div className="text-xs text-gray-500">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          CTA FINAL
      ══════════════════════════════════════ */}
      <section className="py-28 px-6 relative">
        <GradientOrb className="w-[800px] h-[800px] bg-fuchsia-700 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-15" />

        <div className="relative max-w-3xl mx-auto text-center">
          <div className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] rounded-[2rem] p-12 md:p-16 backdrop-blur-sm">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-600 mb-6 shadow-2xl shadow-fuchsia-500/30">
              <RiFlashlightLine className="text-white text-2xl" />
            </div>
            <h2 className="text-3xl md:text-5xl font-black mb-5 leading-tight">
              Prêt à digitaliser
              <br />
              <span className="bg-gradient-to-r from-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
                votre commerce ?
              </span>
            </h2>
            <p className="text-gray-400 mb-8 text-lg">
              Rejoignez 500+ commerçants marocains qui font confiance à Souk.AI chaque jour.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="group inline-flex items-center justify-center gap-3 bg-gradient-to-r from-fuchsia-500 to-violet-600 hover:from-fuchsia-400 hover:to-violet-500 text-white px-10 py-4 rounded-2xl font-bold text-lg transition-all duration-300 shadow-2xl shadow-fuchsia-500/30 hover:shadow-fuchsia-500/50 hover:scale-[1.02]"
              >
                Créer mon compte — Gratuit
                <RiArrowRightLine className="text-xl group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            <p className="mt-5 text-xs text-gray-600 flex items-center justify-center gap-2">
              <RiCheckLine className="text-emerald-500" />
              Aucune carte bancaire · Aucune installation · Résultats immédiats
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FOOTER
      ══════════════════════════════════════ */}
      <footer id="contact" className="border-t border-white/[0.05] py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center">
                  <RiStore2Line className="text-white text-sm" />
                </div>
                <span className="text-xl font-black bg-gradient-to-r from-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
                  Souk.AI
                </span>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
                L'assistant IA pour les commerçants marocains.
                Gérez votre business par WhatsApp, en Darija, Français ou Tamazight.
              </p>
              <div className="mt-5 flex items-center gap-3">
                <a
                  href="https://wa.me/212XXXXXXXXX"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-2 rounded-xl hover:bg-emerald-500/20 transition-colors"
                >
                  <RiWhatsappLine className="text-base" />
                  +212 623 572 558
                </a>
              </div>
            </div>

            {/* Links */}
            <div>
              <h4 className="font-semibold text-white text-sm mb-4 uppercase tracking-wider">Produit</h4>
              <ul className="space-y-2.5 text-sm text-gray-500">
                {[
                  ["Fonctionnalités", "#features"],
                  ["Comment ça marche", "#how"],
                  ["Témoignages", "#testimonials"],
                ].map(([label, href]) => (
                  <li key={label}>
                    <a href={href} className="hover:text-white transition-colors flex items-center gap-2 group">
                      <RiArrowRightLine className="text-xs opacity-0 group-hover:opacity-100 transition-opacity" />
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white text-sm mb-4 uppercase tracking-wider">Compte</h4>
              <ul className="space-y-2.5 text-sm text-gray-500">
                {[
                  ["Se connecter", "/login"],
                  ["Créer un compte", "/register"],
                ].map(([label, href]) => (
                  <li key={label}>
                    <Link to={href} className="hover:text-white transition-colors flex items-center gap-2 group">
                      <RiArrowRightLine className="text-xs opacity-0 group-hover:opacity-100 transition-opacity" />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-8 border-t border-white/[0.05] flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-600">
              © {new Date().getFullYear()} Souk.AI — Tous droits réservés · Casablanca, Maroc
            </p>
            <div className="flex items-center gap-4 text-xs text-gray-600">
              <span>Boulevard Mohammed V, Casablanca</span>
              <span className="w-1 h-1 rounded-full bg-gray-700" />
              <span>souk-ai.duckdns.org</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
