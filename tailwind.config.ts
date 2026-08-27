import type { Config } from 'tailwindcss';

// Colour tokens from BRIEF.md 6.2. Amber (signal) is the primary accent and
// stays scarce, roughly 5% of the visual field. Cyan (current) carries
// structure, labels and focus states.
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#06080D',
        'ink-2': '#0C1119',
        'ink-3': '#141B27',
        blueprint: '#1E3A5F',
        signal: '#FFB03A',
        'signal-dim': '#B87A1F',
        current: '#4FD1E0',
        paper: '#E8EDF2',
        muted: '#8A99AF',
        line: 'rgba(232,237,242,0.08)',
        glass: 'rgba(20,27,39,0.55)',
        'glass-edge': 'rgba(232,237,242,0.10)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        h1: ['clamp(2.75rem, 7vw, 6.5rem)', { lineHeight: '0.98', letterSpacing: '-0.03em' }],
        h2: ['clamp(2rem, 4.5vw, 3.75rem)', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
        h3: ['clamp(1.25rem, 2vw, 1.75rem)', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        body: ['clamp(1rem, 1.1vw, 1.125rem)', { lineHeight: '1.65' }],
        label: ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.12em' }],
      },
      maxWidth: { content: '1400px', prose: '68ch' },
    },
  },
  plugins: [],
};
export default config;
