export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: { red: '#C31E24', navy: '#051A31', deep: '#03080F', cream: '#F9F6EF' },
    fontFamily: { display: ['"Bebas Neue"','Impact','sans-serif'], sans: ['Barlow','Helvetica Neue','Arial','sans-serif'] },
    borderRadius: { card: '20px' },
  } },
};
