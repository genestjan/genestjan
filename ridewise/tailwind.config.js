/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#0f1b2d', 2: '#16263d', 3: '#1f3352' },
        go: { DEFAULT: '#15803d', soft: '#dcfce7' },
        caution: { DEFAULT: '#b45309', soft: '#fef3c7' },
        danger: { DEFAULT: '#b91c1c', soft: '#fee2e2' },
        sky: { DEFAULT: '#0369a1', soft: '#e0f2fe' },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
