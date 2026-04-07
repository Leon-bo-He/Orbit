import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        // Workspace palette — assigned at workspace creation, immutable
        'ws-indigo':   '#6366f1',
        'ws-rose':     '#f43f5e',
        'ws-amber':    '#f59e0b',
        'ws-emerald':  '#10b981',
        'ws-sky':      '#0ea5e9',
        'ws-violet':   '#8b5cf6',
        'ws-pink':     '#ec4899',
        'ws-teal':     '#14b8a6',
        // CSS-variable-backed tokens — respond to .dark automatically
        surface:        'var(--color-surface)',
        'surface-raised': 'var(--color-surface-raised)',
      },
    },
  },
  plugins: [],
} satisfies Config;
