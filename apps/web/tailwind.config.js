module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // One family everywhere. `--font-inter` (set in app/layout.tsx) already ends with the backup fonts;
      // the explicit list below is a second safety net.
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      backgroundImage: {
        // Brand gradient: sunset orange -> magenta -> purple
        spectrum: 'linear-gradient(90deg,#fa7e1e,#d62976,#962fbf)',
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
