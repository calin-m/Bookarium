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
          50: '#fdf6ee',
          100: '#fbe8d5',
          200: '#f7cea9',
          300: '#f2ad73',
          400: '#ec843f',
          500: '#e5641e',
          600: '#c05621',
          700: '#ab3e1c',
          800: '#89321c',
          900: '#712a19',
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
          50: '#fdfcfb',
          100: '#f9f8f6',
          200: '#f3f1ec',
          300: '#ebe7e0',
          400: '#ded8cc',
          500: '#ccc3b2',
          600: '#b4a894',
          700: '#968875',
          800: '#7a6e5f',
          900: '#645a4f',
        },
        booksaw: {
          canvas: '#f9f8f6',
          card: '#ffffff',
          ink: '#111111',
          muted: '#666666',
          border: '#e8e5df',
          accent: '#c05621',
          darkCanvas: '#0e1117',
          darkCard: '#161b26',
          darkBorder: '#252c3b',
        },
        shelf: {
          wood: '#2d3748',
          woodLight: '#4a5568',
          woodDark: '#1a202c',
          linen: '#f7fafc',
          linenDark: '#1a202c',
        },
      },
      boxShadow: {
        'book': '0 4px 6px -1px rgba(0, 0, 0, 0.06), 0 2px 4px -2px rgba(0, 0, 0, 0.04)',
        'book-hover': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.06)',
        'booksaw': '0 10px 30px -10px rgba(0, 0, 0, 0.08), 0 4px 12px -2px rgba(0, 0, 0, 0.04)',
        'booksaw-hover': '0 20px 40px -15px rgba(0, 0, 0, 0.14), 0 10px 20px -5px rgba(0, 0, 0, 0.08)',
        'modern-sm': '0 2px 8px -2px rgba(0,0,0,0.05), 0 1px 4px -1px rgba(0,0,0,0.03)',
        'modern-md': '0 12px 30px -10px rgba(0,0,0,0.08), 0 4px 12px -2px rgba(0,0,0,0.04)',
        'modern-hover': '0 20px 40px -15px rgba(0,0,0,0.12), 0 8px 16px -4px rgba(0,0,0,0.06)',
        'spine': 'inset -3px 0 5px rgba(0,0,0,0.2), inset 3px 0 5px rgba(255,255,255,0.12)',
        'shelf-ledge': '0 10px 20px -5px rgba(0,0,0,0.25), inset 0 1px 2px rgba(255,255,255,0.1)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Playfair Display', 'Cormorant Garamond', 'Georgia', 'serif'],
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
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'pulse-subtle': 'pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
