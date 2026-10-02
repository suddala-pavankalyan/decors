module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { display: ['Georgia', 'serif'] },
      keyframes: { float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-12px)' } } },
      animation: { float: 'float 6s ease-in-out infinite' },
    },
  },
  plugins: [],
};
