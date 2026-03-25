/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#1c1c1e',
          secondary: '#161618',
          sidebar: '#141416',
          input: '#2a2a2e',
          hover: '#2c2c30',
          elevated: '#252528',
          chip: '#2a2a2e',
        },
        t: {
          primary: '#e8e8e6',
          secondary: '#9a9a9a',
          tertiary: '#6b6b6b',
          placeholder: '#6b6b6b',
          heading: '#c8c5be',
        },
        b: {
          DEFAULT: '#2e2e30',
          light: '#363638',
          dark: '#222224',
        },
        accent: {
          DEFAULT: '#d4874e',
          green: '#4ade80',
          blue: '#0081f2',
        },
        send: {
          DEFAULT: '#4a4a4e',
          active: '#e8e8e6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        heading: ['Georgia', 'Times New Roman', 'serif'],
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

