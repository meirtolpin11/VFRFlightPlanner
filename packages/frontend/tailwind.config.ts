import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'fp-bg': '#0d1117',
        'fp-panel': '#161b27',
        'fp-panel-2': '#1c2333',
        'fp-border': '#21293d',
        'fp-border-2': '#2d3a52',
        'fp-accent': '#3b82f6',
        'fp-accent-2': '#0ea5e9',
        'fp-text': '#e2e8f0',
        'fp-muted': '#64748b',
        'fp-muted-2': '#8899aa',
        'fp-success': '#22c55e',
        'fp-warn': '#f59e0b',
        'fp-danger': '#ef4444',
      }
    }
  },
  plugins: []
} satisfies Config
