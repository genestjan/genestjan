/** @type {import('tailwindcss').Config} */
// Colour tokens from the genestjanramirez.com design system (BRIEF.md 6.2): near-black ink,
// amber signal as the scarce primary accent, cyan current for structure and focus.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#06080D', 2: '#0C1119', 3: '#141B27', 4: '#1A2333', 5: '#222D40' },
        blueprint: '#1E3A5F',
        signal: { DEFAULT: '#FFB03A', dim: '#B87A1F', soft: 'rgba(255,176,58,0.12)' },
        current: { DEFAULT: '#4FD1E0', soft: 'rgba(79,209,224,0.12)' },
        paper: '#E8EDF2',
        muted: '#8A99AF',
        faint: '#5B6577',
        line: 'rgba(232,237,242,0.08)',
        'line-strong': 'rgba(232,237,242,0.14)',
        income: { DEFAULT: '#3DD68C', soft: 'rgba(61,214,140,0.14)' },
        expense: { DEFAULT: '#FF6B6B', soft: 'rgba(255,107,107,0.14)' },
        savings: { DEFAULT: '#4FD1E0', soft: 'rgba(79,209,224,0.14)' },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { card: '18px' },
      boxShadow: {
        card: '0 1px 0 rgba(232,237,242,0.04) inset, 0 12px 32px rgba(0,0,0,0.35)',
        glow: '0 0 0 1px rgba(255,176,58,0.35), 0 8px 28px rgba(255,176,58,0.18)',
      },
    },
  },
  plugins: [],
};
