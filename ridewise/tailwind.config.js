/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand: deep teal from the logo rim, with peach from the spokes and arrow tip.
        brand: {
          50: '#f1f8f8',
          100: '#dff0f0',
          200: '#bfe0e1',
          300: '#8fc6c9',
          400: '#5aa7ae',
          500: '#3b8f99',
          600: '#2c7a86',
          700: '#236472',
          800: '#1d5060',
          900: '#17404d',
        },
        peach: { DEFAULT: '#f4a97a', soft: '#fdeee4', deep: '#c2662b' },
        // Existing class names keep working; their colours now follow the brand.
        navy: { DEFAULT: '#243447', 2: '#2f4358', 3: '#3b536b' },
        go: { DEFAULT: '#177a52', soft: '#e0f5ec' },
        caution: { DEFAULT: '#b45f0b', soft: '#fff1dc' },
        danger: { DEFAULT: '#d32f2f', soft: '#fdeaea' },
        sky: { DEFAULT: '#236472', soft: '#e3f2f3' },
        page: '#f3f6fa',
        band: '#e3e9f0',
      },
      fontFamily: {
        sans: ['Roboto', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Montserrat', 'Roboto', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 6px 22px rgba(36, 52, 71, 0.08)',
        lift: '0 10px 30px rgba(36, 52, 71, 0.14)',
      },
      borderRadius: { '4xl': '2rem' },
    },
  },
  plugins: [],
};
