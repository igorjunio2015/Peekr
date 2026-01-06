/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx}',
    './index.html',
    './node_modules/streamdown/dist/*.js'
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
