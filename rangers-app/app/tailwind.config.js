export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: { red: 'var(--red)', gold: 'var(--gold)', ink: 'var(--gold-ink)', navy: '#0a1f44', deep: '#061633', cream: '#F9F6EF', crest: '#C31E24' },
    fontFamily: { display: ['"Bebas Neue"','Impact','sans-serif'], sans: ['Barlow','Helvetica Neue','Arial','sans-serif'] },
    borderRadius: { card: '20px' },
  } },
};
