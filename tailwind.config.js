/**
 * BYU brand tokens.
 *
 * Navy #002E5D is BYU's primary colour. Royal #0047BA is taken straight out of the calendar API
 * payload, which ships its own theme fields (`primaryLinkColor`, `headerDividerColor`,
 * `buttonBgColor1` all return #0047ba) — so link and button blue here is literally the value BYU's
 * own calendar renders with, not a guess from a screenshot. Same for the typeface: the payload
 * returns `bodyFont: "IBM Plex Sans"`.
 *
 * Category accents are a restrained extension, not official BYU colours. They exist because the
 * Planner view needs eight visually separable chips and navy-on-navy is unreadable. Each one is
 * darkened to hold at least 4.5:1 against white for its text pairing.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#eef3f9',
          100: '#d8e3f0',
          200: '#adc4de',
          300: '#7b9cc4',
          400: '#4a73a7',
          500: '#1f4e85',
          DEFAULT: '#002E5D',
          600: '#002850',
          700: '#002145',
          800: '#001a35',
          900: '#001124'
        },
        royal: {
          50: '#eff5ff',
          100: '#dbe8fe',
          200: '#bfd6fe',
          300: '#93b8fd',
          DEFAULT: '#0047BA',
          600: '#003da1',
          700: '#003285'
        },
        ink: '#0d1b2a',
        muted: '#5a6779',
        line: '#e3e7ee',
        canvas: '#f6f8fb',
        /*
         * BYU's own values, read off calendar.byu.edu (see src/index.css for provenance).
         * Used by the Campus design, which recreates that site's chrome, and kept separate from
         * the `navy`/`royal` scales above so tuning our designs can never drift BYU's.
         */
        byu: {
          navy: '#002e5d',
          royal: '#0057b8',
          link: '#0047ba',
          sky: '#afd6fe',
          red: '#ff1e3c',
          grey: '#f0efed',
          rule: '#e6e6e6',
          ruleDark: '#cccccc',
          charcoal: '#333333',
          slate: '#666666',
          black: '#141414'
        },
        // Category accents (Planner chips, Discover rails)
        cat: {
          athletics: '#0047BA',
          arts: '#7a1f6b',
          student: '#0f766e',
          education: '#1f4e85',
          devotional: '#6d4c1f',
          wellness: '#15803d',
          conference: '#9a3412',
          other: '#4b5563'
        }
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"IBM Plex Serif"', 'Georgia', 'serif']
      },
      boxShadow: {
        card: '0 1px 2px rgba(13, 27, 42, 0.04), 0 4px 12px rgba(13, 27, 42, 0.06)',
        lift: '0 2px 4px rgba(13, 27, 42, 0.06), 0 12px 28px rgba(13, 27, 42, 0.12)'
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.23, 1, 0.32, 1)'
      }
    }
  }
}
