/** Souk.AI mark: shop awning over a rising line — "your shop, going the right way" (docs/BRAND.md). */
export default function BrandMark({ className = 'h-8 w-8', title = 'Souk.AI' }) {
  return (
    <svg viewBox="0 0 64 64" className={`${className} shrink-0`} role="img" aria-label={title}>
      <rect width="64" height="64" rx="15" fill="#C2410C" />
      <path d="M12 11h40v13.5a5 5 0 0 1-10 0 5 5 0 0 1-10 0 5 5 0 0 1-10 0 5 5 0 0 1-10 0Z" fill="#FAF7F2" />
      <path d="M22 19.5v5M32 19.5v5M42 19.5v5" stroke="#C2410C" strokeWidth="2" />
      <path d="M15 52l10-8 7 4 15-12M39 36h8v8" fill="none" stroke="#5EEAD4" strokeWidth="5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
