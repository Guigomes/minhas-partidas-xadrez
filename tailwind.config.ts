import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Verde de tabuleiro (casas escuras do xadrez) — cor principal do tema
        brand: {
          50: '#f4f8ee',
          100: '#e6efd8',
          200: '#cfe0b4',
          300: '#b0cb87',
          400: '#93b564',
          500: '#7ba047',
          600: '#648a38',
          700: '#4f6e2e',
          800: '#415a28',
          900: '#374b24',
          950: '#1c2a0f',
        },
        // Dourado "troféu/xeque-mate" — acento
        gold: '#eab308',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
