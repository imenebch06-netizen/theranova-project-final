/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FFFBF0",
        sand: "#F6F0E1",
        sage: {
          50: "#F4F6EC",
          100: "#E8EDD9",
          200: "#D8E0C2",
          300: "#CCD5B5",
          400: "#B4C096",
          500: "#97A676",
        },
        teal: {
          50: "#EAF0EE",
          100: "#D3E1DD",
          200: "#A7C3BD",
          300: "#6E9B96",
          400: "#3D7370",
          500: "#1A5255",
          600: "#154547",
          700: "#123E41",
          800: "#0E3234",
          900: "#0A2527",
        },
        ink: "#102F31",
        muted: "#6E7F78",
        line: "#E8E1D1",
        terracotta: "#C97B5A",
        gold: "#E8C97A",
        risk: "#B85C4A",
        success: "#3F7A5E",
        warn: "#C99038",
      },
      fontFamily: {
        sans: ["Lato", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["Lato", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 18px 50px -24px rgba(16, 47, 49, 0.22)",
        card: "0 2px 10px -4px rgba(16, 47, 49, 0.10)",
        lift: "0 30px 70px -30px rgba(16, 47, 49, 0.35)",
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.75rem",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: 0, transform: "translateY(16px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.55 },
        },
        "scale-in": {
          "0%": { opacity: 0, transform: "scale(0.97)" },
          "100%": { opacity: 1, transform: "scale(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s ease-out both",
        float: "float 7s ease-in-out infinite",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "scale-in": "scale-in 0.25s ease-out both",
      },
    },
  },
  plugins: [],
};
