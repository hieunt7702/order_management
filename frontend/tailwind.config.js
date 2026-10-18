/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/react-tailwindcss-datepicker/dist/index.esm.js",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  safelist: [
    'lg:max-w-xs',
    'lg:max-w-sm',
    'lg:max-w-md',
    'lg:max-w-lg',
    'lg:max-w-xl',
    'lg:max-w-2xl',
    'lg:max-w-3xl',
    'lg:max-w-4xl',
    'lg:max-w-5xl',
    'lg:max-w-6xl',
    'lg:max-w-7xl',
    'lg:max-w-[96vw]',
    'lg:w-[96vw]',
    'lg:w-auto',
    'lg:w-full',
  ],
  plugins: [],
}
