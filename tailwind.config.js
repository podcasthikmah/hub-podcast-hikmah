/** Design tokens live as CSS variables in src/index.css (light + dark). */
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        brand: token('brand'),
        'on-brand': token('on-brand'),
        accent: token('accent'),
        'on-accent': token('on-accent'),
        ink: token('ink'),
        muted: token('muted'),
        line: token('line'),
        primary: token('primary'),
        danger: token('danger'),
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        arabic: ['Amiri', '"IBM Plex Sans Arabic"', 'serif'],
        ui_ar: ['Tajawal', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '16px', btn: '12px' },
      boxShadow: {
        soft: '0 1px 2px rgb(15 76 58 / 0.04), 0 8px 24px -12px rgb(15 76 58 / 0.18)',
      },
    },
  },
  plugins: [],
};
