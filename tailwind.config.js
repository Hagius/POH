/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#1a1a2e',
          card: '#16213e',
          border: '#0f3460',
        },
        gold: '#FFD700',
      },
    },
  },
  plugins: [],
}
