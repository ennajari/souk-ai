/** @type {import('tailwindcss').Config} */
// Souk.AI brand tokens — see docs/BRAND.md. Use brand/mint/sand/ink, not raw Tailwind hues.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: { xs: '375px' },
      colors: {
        // Terracotta: primary actions, brand. 600 on white = 5.2:1 (WCAG AA for text and buttons)
        brand: {
          50: '#FDF5F1', 100: '#FAE6DC', 200: '#F4C9B5', 300: '#EBA385', 400: '#DF7853',
          500: '#D35A31', 600: '#C2410C', 700: '#9A3412', 800: '#7C2D12', 900: '#5C2210', 950: '#3B1309',
        },
        // Mint (zellige green): secondary accent, positive money
        mint: {
          50: '#F0FDFA', 100: '#CCFBF1', 200: '#99F6E4', 300: '#5EEAD4', 400: '#2DD4BF',
          500: '#14B8A6', 600: '#0D9488', 700: '#0F766E', 800: '#115E59', 900: '#134E4A', 950: '#042F2E',
        },
        sand: { 50: '#FDFBF8', 100: '#FAF7F2', 200: '#F3EDE3', 300: '#E7DDCD' },
        ink: { 700: '#44403C', 800: '#292524', 900: '#1C1917', 950: '#0F0D0C' },
      },
      fontFamily: {
        sans: ['Inter', '"IBM Plex Sans Arabic"', 'system-ui', '-apple-system', 'sans-serif'],
        arabic: ['"IBM Plex Sans Arabic"', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
