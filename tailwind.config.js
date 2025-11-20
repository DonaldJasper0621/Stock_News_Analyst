/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class', // 👈👈 一定要有這行，且是 'class'
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {},
    },
    plugins: [],
}
