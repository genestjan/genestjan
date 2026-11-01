/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './driver/index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { neon: '#7ff004', lime: '#b9f73c', leaf: '#3fae2a', ink: '#050d05', coal: '#0d1a0d', fog: '#f4f7f2' },
      fontFamily: { brand: ['"Russo One"', 'sans-serif'], sans: ['Inter', 'system-ui', 'sans-serif'] },
      boxShadow: { glow: '0 0 24px rgba(127,240,4,.45)' },
    },
  },
  plugins: [],
};
