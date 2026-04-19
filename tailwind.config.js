/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app.html", "./server.js"],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'sans-serif'] },
      animation: {
        'float':      'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4,0,0.6,1) infinite',
        'fade-in':    'fadeIn 0.4s ease-out',
      },
      keyframes: {
        float:   { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        fadeIn:  { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      }
    },
  },
  plugins: [],
}
