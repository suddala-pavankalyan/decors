module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // One family everywhere (Figtree; its rupee-sign file comes second), then the visitor's own UI font.
      fontFamily: {
        sans: ['var(--font-figtree)', 'var(--font-figtree-ext)', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      // Figtree reads heavier than Inter at the same weight, so the heaviest weights step down a notch.
      fontWeight: { semibold: '600', bold: '650', extrabold: '700' },
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
