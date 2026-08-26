/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        astra: {
          dark: '#050811',
          card: '#0c1222',
          border: '#1e293b',
          cyan: '#06b6d4',
          danger: '#ef4444',
          warning: '#f59e0b',
          success: '#10b981',
        },
      },
    },
  },
  plugins: [],
}
