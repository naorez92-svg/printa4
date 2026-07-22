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
        growdeep: "#0E7C5F",
        steel: "#2B3A55",
      },
      fontFamily: {
        sans: ["Assistant", "sans-serif"],
        mono: ["Rubik", "sans-serif"],
      },
    },
  },
  plugins: [],
};
