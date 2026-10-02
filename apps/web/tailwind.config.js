module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { display: ['Georgia', 'serif'] },
      colors: {
        // Dark "ink" surface for the hero, in the family of AWS's squid-ink navy.
        ink: { 900: '#0f1626', 800: '#161e2d', 700: '#232f3e' },
      },
      backgroundImage: {
        // Instagram-style spectrum: amber -> orange -> magenta -> purple -> indigo
        spectrum: 'linear-gradient(90deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)',
      },
      keyframes: {
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-12px)' } },
        shift: { '0%': { backgroundPosition: '0% 50%' }, '100%': { backgroundPosition: '200% 50%' } },
        drift: {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(2%,-3%,0) scale(1.08)' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        shift: 'shift 8s linear infinite',
        drift: 'drift 14s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
