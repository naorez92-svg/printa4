/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#20184A",
        canvas: "#F7F6FB",
        brand: "#F4A02C",
        magic: "#6C5CE7",
        grow: "#1FB58F",
        steel: "#2B3A55",
      },
      fontFamily: {
        display: ['"Baloo 2"', "cursive"],
        sans: ["Assistant", "sans-serif"],
        mono: ["Rubik", "sans-serif"],
      },
    },
  },
  plugins: [],
};
