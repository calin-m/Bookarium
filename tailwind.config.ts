import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
          50: '#fdf8f0',
          100: '#faedd7',
          200: '#f4d9ad',
          300: '#ecbe7a',
          400: '#e39f48',
          500: '#d98226',
          600: '#c5681c',
          700: '#a34d19',
          800: '#843d1a',
          900: '#6c3318',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        paper: {
          50: '#fcfbf9',
          100: '#faf8f5',
          200: '#f5f1ea',
          300: '#ece5da',
          400: '#dfd5c4',
          500: '#cec0ab',
          600: '#b8a68e',
          700: '#9b876f',
          800: '#7f6e5a',
          900: '#685a4a',
        },
        sepia: {
          bg: '#f5eedb',
          surface: '#ede3cb',
          text: '#3e2d1e',
          muted: '#7a654e',
          border: '#decfae',
        },
        shelf: {
          wood: '#3a2414',
          woodLight: '#593a22',
          woodDark: '#24150b',
          linen: '#e6ded3',
          linenDark: '#26221f',
        },
      },
      boxShadow: {
        'book': '0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.05), -2px 0 4px -1px rgba(0, 0, 0, 0.04)',
        'book-hover': '0 20px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08), -4px 0 8px -2px rgba(0, 0, 0, 0.06)',
        'spine': 'inset -3px 0 5px rgba(0,0,0,0.25), inset 3px 0 5px rgba(255,255,255,0.15)',
        'shelf-ledge': '0 10px 15px -3px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.15)',
        'paper-edge': '2px 0 4px rgba(0,0,0,0.06)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Playfair Display', 'Merriweather', 'Georgia', 'Cambria', 'serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'book-pull': {
          '0%': { transform: 'translateY(0) scale(1)' },
          '100%': { transform: 'translateY(-12px) scale(1.03)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'pulse-subtle': 'pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'book-pull': 'book-pull 0.25s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
      },
    },
  },
  plugins: [],
};

export default config;
