export const theme = {
  colors: {
    zinc: {
      50: '#fafafa',
      100: '#f4f4f5',
      200: '#e4e4e7',
      300: '#d4d4d8',
      400: '#a1a1aa',
      500: '#71717a',
      700: '#3f3f46',
      800: '#27272a',
      900: '#18181b',
      950: '#09090b',
    },
    emerald: {
      400: '#34d399',
      500: '#10b981',
      600: '#059669',
    },
    blue: {
      400: '#60a5fa',
      500: '#3b82f6',
    },
    amber: {
      400: '#fbbf24',
      500: '#f59e0b',
    },
    red: {
      400: '#f87171',
      500: '#ef4444',
    },
    purple: {
      400: '#c084fc',
      500: '#a855f7',
    },
  },
  borderRadius: {
    none: 0,
    sm: 2,
    md: 6,
    lg: 8,
    xl: 12,
    xxl: 16,
    full: 9999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
} as const;

export type Theme = typeof theme;
