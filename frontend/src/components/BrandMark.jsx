/** Souk.AI mark: Moroccan horseshoe arch + eight-pointed zellige star (docs/BRAND.md). */
export default function BrandMark({ className = 'h-8 w-8', title = 'Souk.AI' }) {
  return (
    <svg viewBox="0 0 64 64" className={`${className} shrink-0`} role="img" aria-label={title}>
      <rect width="64" height="64" rx="15" fill="#C2410C" />
      <path d="M21.5 53V41.5A14 14 0 1 1 42.5 41.5V53" fill="none" stroke="#FAF7F2" strokeWidth="5"
        strokeLinecap="round" strokeLinejoin="round" />
      <g transform="translate(32 31.5)" fill="#5EEAD4">
        <rect x="-5.6" y="-5.6" width="11.2" height="11.2" />
        <rect x="-5.6" y="-5.6" width="11.2" height="11.2" transform="rotate(45)" />
      </g>
    </svg>
  )
}
