import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:       '#0e1726',
        surface:  '#162030',
        surface2: '#1e2d42',
        surface3: '#2a3d56',
        accent:   '#3b82f6',
        accent2:  '#60a5fa',
        green:    '#34d399',
        red:      '#f87171',
        yellow:   '#fbbf24',
        orange:   '#fb923c',
        cyan:     '#22d3ee',
        text1:    '#e0eaf4',
        text2:    '#7a94b0',
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
      borderRadius: {
        card: '14px',
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in':  'fadeIn 0.2s ease-out',
      },
      keyframes: {
        slideUp:  { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        fadeIn:   { from: { opacity: '0' },                  to: { opacity: '1' } },
      },
    },
  },
  plugins: [],
} satisfies Config
