/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Trade Republic Color Palette
        dark: {
          bg: '#000000',        // Pure black for dark mode
          card: '#121212',      // Dark charcoal for cards
          border: '#1C1C1E',    // Subtle dark border
        },
        light: {
          bg: '#FFFFFF',        // Pure white
          card: '#F9F9F9',      // Subtle off-white
          border: '#E5E5EA',    // Light gray border
        },
        // Functional colors
        positive: '#00C805',    // Neon green for growth/positive
        negative: '#FF3B30',    // Vivid red for loss/negative
        trophy: '#FFCC00',      // Golden yellow for rewards
        gold: '#FFD700',        // Keep for backward compatibility
        muted: '#8E8E93',       // Medium gray for secondary text
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', 'Helvetica Neue', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}
