/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        steel: '#0F172A',
        panel: '#1E293B',
        line: '#334155',
        accent: '#F59E0B',
        spark: '#38BDF8',
        ok: '#34D399',
        danger: '#F87171',
        paper: '#F8FAFC',
      },
      fontFamily: {
        display: ['Heebo', 'sans-serif'],
        sans: ['Rubik', 'Heebo', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
