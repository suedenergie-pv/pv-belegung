import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // internes Dashboard-CI (SPEC §12)
        akzent: '#e8603a',
        grund: '#f4f6f8',
      },
    },
  },
  plugins: [],
};

export default config;
