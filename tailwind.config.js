/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0f0f12',
          secondary: '#0c0c0f',
          sidebar: '#0b0b0e',
          input: '#1a1a1e',
          hover: '#1e1e24',
          elevated: '#17171b',
          chip: '#1a1a1e',
        },
        t: {
          primary: '#e8e8e6',
          secondary: '#9a9a9a',
          tertiary: '#5a5a62',
          placeholder: '#4a4a52',
          heading: '#c8c8c6',
        },
        b: {
          DEFAULT: '#1e1e22',
          light: '#2a2a30',
          dark: '#141418',
        },
        accent: {
          DEFAULT: '#3b82f6',
          green: '#4ade80',
          blue: '#3b82f6',
          purple: '#a78bfa',
        },
        send: {
          DEFAULT: '#2a2a30',
          active: '#e8e8e6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        heading: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-dot': 'pulseDot 1.4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseDot: {
          '0%, 80%, 100%': { opacity: '0.3', transform: 'scale(0.8)' },
          '40%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
