module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'fog-dark': '#0a0c10',
        'fog-surface': '#12161f',
        'fog-border': '#1e2533',
        'fog-gold': '#c5a059',
        'fog-text': '#e2e8f0',
        'fog-muted': '#8a94a6',
        'fog-accent': '#6d4c41',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Cinzel', 'serif'],
      },
    },
  },
  plugins: [],
};
