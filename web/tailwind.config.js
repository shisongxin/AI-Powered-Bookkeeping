/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm gold — primary brand color
        gold: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        // Deep espresso — dark surfaces
        espresso: {
          50:  '#faf7f5',
          100: '#ece4de',
          200: '#d7ccc2',
          300: '#bca997',
          400: '#a1886d',
          500: '#8b7355',
          600: '#6b5742',
          700: '#4a3b2e',
          800: '#2d241c',
          900: '#1c1917',
          950: '#0f0d0b',
        },
        // Emerald — income green
        emerald: {
          50:  '#ecfdf5',
          500: '#10b981',
          600: '#059669',
        },
        // Coral — expense red
        coral: {
          50:  '#fef2f2',
          500: '#f04444',
          600: '#dc2626',
        },
      },
      fontFamily: {
        display: ['"Georgia"', '"Noto Serif SC"', 'serif'],
        body: ['"PingFang SC"', '"Microsoft YaHei"', '"Hiragino Sans GB"', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
        '4xl': '1.75rem',
      },
      boxShadow: {
        'gold': '0 4px 24px -4px rgba(245, 158, 11, 0.25)',
        'gold-lg': '0 8px 40px -4px rgba(245, 158, 11, 0.35)',
        'card': '0 1px 3px rgba(28, 25, 23, 0.06), 0 4px 16px rgba(28, 25, 23, 0.04)',
        'card-hover': '0 2px 8px rgba(28, 25, 23, 0.08), 0 8px 32px rgba(28, 25, 23, 0.06)',
        'glass': '0 0 0 1px rgba(255,255,255,0.1), 0 4px 24px rgba(0,0,0,0.12)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'shimmer': 'shimmer 2s infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
};
