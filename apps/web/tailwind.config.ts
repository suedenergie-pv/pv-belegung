import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // internes Dashboard-CI (SPEC §12)
        // Dunklere Bedienfarbe für weißen Text und aktive Beschriftungen (>= 4,5:1).
        // Das kanonische Logo und die Modul-Assets behalten ihre Originalfarben.
        akzent: '#b83d1e',
        marke: '#e8603a',
        grund: '#f4f6f8',
      },
    },
  },
  plugins: [],
};

export default config;
