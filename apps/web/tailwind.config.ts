import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Workspace palette — assigned at workspace creation, immutable
        'ws-indigo': '#6366f1',
        'ws-rose': '#f43f5e',
        'ws-amber': '#f59e0b',
        'ws-emerald': '#10b981',
        'ws-sky': '#0ea5e9',
        'ws-violet': '#8b5cf6',
        'ws-pink': '#ec4899',
        'ws-teal': '#14b8a6',
        // App shell
        surface: '#f9fafb',
        'surface-raised': '#ffffff',
      },
    },
  },
  plugins: [],
} satisfies Config;
