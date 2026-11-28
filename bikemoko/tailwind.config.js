/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        raised: v('raised'),
        line: v('line'),
        ink: v('ink'),
        muted: v('muted'),
        faint: v('faint'),
        brand: { DEFAULT: v('brand'), ink: v('brand-ink'), soft: v('brand-soft') },
        ok: v('ok'),
        warn: v('warn'),
        bad: v('bad'),
        info: v('info'),
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk Variable"', '"Inter Variable"', 'sans-serif'],
      },
      borderRadius: { xl: '14px', '2xl': '18px', '3xl': '24px' },
      boxShadow: {
        card: '0 1px 0 rgb(var(--line) / 0.6), 0 8px 24px -12px rgb(0 0 0 / 0.25)',
        pop: '0 24px 64px -16px rgb(0 0 0 / 0.45)',
        glow: '0 0 0 1px rgb(var(--brand) / 0.5), 0 8px 28px -6px rgb(var(--brand) / 0.55)',
      },
      keyframes: {
        in: { from: { opacity: 0, transform: 'translateY(6px) scale(.99)' }, to: { opacity: 1, transform: 'none' } },
        sheet: { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
        drawer: { from: { transform: 'translateX(100%)' }, to: { transform: 'none' } },
        fade: { from: { opacity: 0 }, to: { opacity: 1 } },
      },
      animation: {
        in: 'in .22s cubic-bezier(.2,.8,.2,1)',
        sheet: 'sheet .28s cubic-bezier(.2,.8,.2,1)',
        drawer: 'drawer .28s cubic-bezier(.2,.8,.2,1)',
        fade: 'fade .2s ease-out',
      },
    },
  },
  plugins: [],
};
