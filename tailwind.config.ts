import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
      },
      colors: {
        dt: {
          'bg-darkest': 'var(--dt-bg-darkest)',
          'bg-darker': 'var(--dt-bg-darker)',
          'bg-dark': 'var(--dt-bg-dark)',
          'bg-panel': 'var(--dt-bg-panel)',
          'border-dark': 'var(--dt-border-dark)',
          'border': 'var(--dt-border)',
          'accent-blue': 'var(--dt-accent-blue)',
          'accent-blue-dark': 'var(--dt-accent-blue-dark)',
          'text-primary': 'var(--dt-text-primary)',
          'text-muted': 'var(--dt-text-muted)',
          'text-muted-lighter': 'var(--dt-text-muted-lighter)',
          'text-muted-lightest': 'var(--dt-text-muted-lightest)',
          'highlight': 'var(--dt-highlight)',
          'highlight-light': 'var(--dt-highlight-light)',
        },
      },
      animation: {
        'dt-shimmer': 'dt-shimmer 2s infinite',
        'dt-pulse': 'dt-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'dt-slide-up': 'dt-slide-up 150ms ease-out',
        'dt-typing': 'dt-typing-dot 1.4s infinite',
        'dt-bar-grow': 'dt-bar-grow 600ms cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        'dt-fast': '100ms',
        'dt-normal': '150ms',
      },
      transitionTimingFunction: {
        'dt-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  darkMode: ['class', '.dark'],
  plugins: [],
}

export default config
