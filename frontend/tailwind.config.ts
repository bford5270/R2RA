import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // USMC-evocative palette — no official marks
        scarlet: {
          DEFAULT: '#CC0000',
          dark:    '#A30000',
        },
        gold: {
          DEFAULT: '#FFCC33',
          dark:    '#E6B800',
        },
        cui: {
          // CUI banner background
          bg:   '#006B35',
          text: '#FFFFFF',
        },
      },
      fontFamily: {
        sans: ['system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
