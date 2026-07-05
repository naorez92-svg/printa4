// מצפן — same design tokens as beshvili (shared brand DNA, separate site).
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
      },
      fontFamily: {
        display: ['"Baloo 2"', "sans-serif"],
        sans: ['"Assistant"', "sans-serif"],
        mono: ['"Rubik"', "sans-serif"],
      },
      boxShadow: {
        card:  "0 4px 24px -8px rgba(32,24,74,0.12)",
        float: "0 12px 40px -12px rgba(108,92,231,0.30), 0 4px 12px -6px rgba(32,24,74,0.10)",
        glow:  "0 0 0 1px rgba(108,92,231,0.10), 0 8px 30px -8px rgba(108,92,231,0.35)",
      },
    },
  },
  plugins: [],
};
