export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

export const radius = {
  xs: 10,
  sm: 14,
  md: 18,
  lg: 24,
  full: 9999,
} as const;

export const typography = {
  h1: { fontSize: 30, fontWeight: '900' as const, letterSpacing: -0.8 },
  h2: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.4 },
  h3: { fontSize: 17, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '600' as const },
  label: { fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.8, textTransform: 'uppercase' as const },
  small: { fontSize: 11, fontWeight: '600' as const },
  stat: { fontSize: 36, fontWeight: '900' as const, letterSpacing: -1 },
} as const;
