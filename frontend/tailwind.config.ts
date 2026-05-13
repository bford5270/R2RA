import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Role 2 Forward design system — token-backed (CSS vars in index.css)
        surface: {
          0: 'var(--surface-0)',
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
          elev: 'var(--surface-elev)',
        },
        ink: {
          1: 'var(--ink-1)',
          2: 'var(--ink-2)',
          3: 'var(--ink-3)',
          4: 'var(--ink-4)',
          inverse: 'var(--ink-inverse)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          press: 'var(--accent-press)',
          on: 'var(--accent-on)',
          focus: 'var(--accent-focus)',
        },
        border1: 'var(--border-1)',
        border2: 'var(--border-2)',
        signal: {
          red: 'var(--signal-red)',
          'red-2': 'var(--signal-red-2)',
          amber: 'var(--signal-amber)',
          'amber-2': 'var(--signal-amber-2)',
          green: 'var(--signal-green)',
          'green-2': 'var(--signal-green-2)',
          blue: 'var(--signal-blue)',
          'blue-2': 'var(--signal-blue-2)',
        },
        // Legacy compatibility — existing pages still reference these
        scarlet: {
          DEFAULT: '#CC0000',
          dark:    '#A30000',
        },
        gold: {
          DEFAULT: '#FFCC33',
          dark:    '#E6B800',
        },
        cui: {
          // CUI banner mandated green per NARA — do not retheme
          bg:   '#006B35',
          text: '#FFFFFF',
        },
      },
      fontFamily: {
        sans: ['var(--font-body)'],
        display: ['var(--font-display)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        1: 'var(--shadow-1)',
        2: 'var(--shadow-2)',
        3: 'var(--shadow-3)',
      },
      letterSpacing: {
        caps: '0.08em',
        'caps-tight': '0.04em',
      },
    },
  },
  plugins: [],
}

export default config
