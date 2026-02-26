import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#111827',
        sand: '#f6f2e9',
        pine: '#18453b',
        ember: '#e76f51'
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui'],
        body: ['"Work Sans"', 'ui-sans-serif', 'system-ui']
      },
      keyframes: {
        floatIn: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        floatIn: 'floatIn 450ms cubic-bezier(0.2, 0.8, 0.2, 1) both'
      }
    }
  },
  plugins: [forms, typography]
};
