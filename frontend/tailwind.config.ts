import type { Config } from 'tailwindcss'

// Role 2 Forward design system — Tailwind integration
//
// Two colour strategies in one config:
//   1. CSS-var tokens (surface/ink/accent/signal/border*) — theme-aware;
//      they flip automatically when data-theme="console" is set.
//   2. Resolved hex values (neutral/green/red/amber/yellow/blue) — so that
//      existing Tailwind utility classes (text-neutral-700, bg-red-50, …)
//      pick up the warm coyote-paper Manual-theme palette automatically.
//
// Fonts: actual family strings (not CSS-var references) so Tailwind's
// JIT generates correct @font-face fallback stacks.

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Self-hosted via @fontsource (CUI-compliant — no CDN)
        display: ['Roboto Slab', 'Georgia', 'Times New Roman', 'serif'],
        sans:    ['IBM Plex Sans', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono:    ['IBM Plex Mono', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
      colors: {
        // ── CSS-var surface / ink / accent tokens (theme-aware) ─────────────
        surface: {
          0:    'var(--surface-0)',
          1:    'var(--surface-1)',
          2:    'var(--surface-2)',
          3:    'var(--surface-3)',
          elev: 'var(--surface-elev)',
        },
        ink: {
          1:       'var(--ink-1)',
          2:       'var(--ink-2)',
          3:       'var(--ink-3)',
          4:       'var(--ink-4)',
          inverse: 'var(--ink-inverse)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover:   'var(--accent-hover)',
          press:   'var(--accent-press)',
          on:      'var(--accent-on)',
        },
        border1: 'var(--border-1)',
        border2: 'var(--border-2)',
        signal: {
          red:      'var(--signal-red)',
          'red-2':  'var(--signal-red-2)',
          amber:    'var(--signal-amber)',
          'amber-2':'var(--signal-amber-2)',
          green:    'var(--signal-green)',
          'green-2':'var(--signal-green-2)',
          blue:     'var(--signal-blue)',
          'blue-2': 'var(--signal-blue-2)',
        },

        // ── Neutral / surface scale (warm coyote paper — Manual theme) ──────
        // Resolved hex values so existing text-neutral-* / bg-neutral-* classes
        // pick up the warm palette without any CSS-var opacity issues.
        neutral: {
          50:  '#FBF6EA',   // --surface-elev
          100: '#F1E8D4',   // --surface-1    (card)
          200: '#E8DCC4',   // --surface-0    (page bg)
          300: '#DCCDB1',   // --surface-2    (inset)
          400: '#C8B295',   // --surface-3 / --border-1
          500: '#8A7B62',   // --ink-4        (disabled)
          600: '#6B5E4A',   // --ink-3        (muted)
          700: '#4A3F30',   // --ink-2        (secondary)
          800: '#2A2218',   // --ink-1        (primary)
          900: '#1A140E',
        },

        // ── Signal — green (GO / pass / confirmed) ───────────────────────────
        green: {
          50:  '#EDF1E7',
          100: '#D8E3CE',
          200: '#BDCFA9',
          300: '#A0BB84',
          400: '#87AB5E',
          500: '#6B7F4F',   // --signal-green
          600: '#6B7F4F',
          700: '#54653D',   // --signal-green-2
          800: '#3E4B2C',
        },

        // ── Signal — red (NO / fail / immediate casualty) ───────────────────
        red: {
          50:  '#F7EDED',
          100: '#EDD8D8',
          200: '#DAAAA9',
          300: '#C97C7B',
          400: '#C25959',
          500: '#B33A3A',   // --signal-red
          600: '#B33A3A',
          700: '#8E2A2A',   // --signal-red-2
          800: '#6B1E1E',
        },

        // ── Signal — amber (caution / delayed / in-progress) ────────────────
        amber: {
          50:  '#FBF3E0',
          100: '#F5E4BC',
          200: '#ECD298',
          300: '#DFB964',
          400: '#D4A83A',
          500: '#C99A2E',   // --signal-amber
          600: '#C99A2E',
          700: '#A07820',   // --signal-amber-2
          800: '#7A5A16',
        },

        // ── Signal — yellow (amber alias for existing yellow-* classes) ──────
        yellow: {
          50:  '#FBF3E0',
          100: '#F5E4BC',
          200: '#ECD298',
          300: '#DFB964',
          400: '#D4A83A',
          500: '#C99A2E',
          600: '#C99A2E',
          700: '#A07820',
          800: '#7A5A16',
        },

        // ── Signal — blue (cold-chain / hypothermia / info) ─────────────────
        blue: {
          50:  '#EBF0F3',
          100: '#D3E2E9',
          200: '#ADCCD8',
          300: '#88B5C5',
          400: '#719DB1',
          500: '#5B7A8B',   // --signal-blue
          600: '#5B7A8B',
          700: '#3F5A6B',   // --signal-blue-2
          800: '#2C4050',
        },

        // ── Brand / USMC ─────────────────────────────────────────────────────
        scarlet: {
          DEFAULT: '#CC0000',
          dark:    '#A30000',
        },
        gold: {
          DEFAULT: '#FFCC33',
          dark:    '#E6B800',
        },

        // ── Olive accent (design system primary interactive color) ───────────
        olive: {
          DEFAULT: '#3F4A33',
          hover:   '#4F5C41',
          press:   '#2F3826',
          on:      '#F1E8D4',
        },

        // ── CUI classification banner ────────────────────────────────────────
        // Design system: dark coyote bg (#3A3025) with warm cream text (#F1E8D4)
        cui: {
          bg:   '#3A3025',
          text: '#F1E8D4',
        },
      },

      // ── Spacing / radius / shadow tokens wired to CSS vars ────────────────
      borderRadius: {
        sm:      'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        md:      'var(--radius-md)',
        lg:      'var(--radius-lg)',
        pill:    'var(--radius-pill)',
      },
      boxShadow: {
        1: 'var(--shadow-1)',
        2: 'var(--shadow-2)',
        3: 'var(--shadow-3)',
      },
      letterSpacing: {
        caps:       '0.08em',
        'caps-tight': '0.04em',
        display:    '-0.01em',
      },
    },
  },
  plugins: [],
}

export default config
