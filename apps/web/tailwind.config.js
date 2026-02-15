/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'ui-serif', 'Georgia', 'serif'],
      },
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        sage: {
          50: '#F4F7F5',
          100: '#E4EBE6',
          200: '#C9D7CC',
          300: '#AEC3B3',
          400: '#93AF99',
          500: '#8AA694',
          600: '#71907C',
          700: '#5A7363',
          800: '#43564A',
          900: '#3A4D41',
        },
        lavender: {
          50: '#F5F3FA',
          100: '#EBE7F5',
          200: '#D7CFEB',
          300: '#C3B7E1',
          400: '#B1A1D7',
          500: '#9F8ECB',
          600: '#8A75BD',
          700: '#6F5CA0',
          800: '#574883',
          900: '#4A3B69',
        },
      },
      boxShadow: {
        soft: '0 12px 40px -12px rgba(0, 0, 0, 0.05)',
        'soft-sm': '0 4px 20px -4px rgba(0, 0, 0, 0.04)',
        'soft-lg': '0 20px 60px -15px rgba(0, 0, 0, 0.07)',
      },
    },
  },
  plugins: [],
};
