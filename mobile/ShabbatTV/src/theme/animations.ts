/**
 * Animation configs aligned with app.html web design
 * Uses React Native built-in Animated API
 */

// Spring configs for RN Animated.spring()
export const springs = {
  default: { friction: 8, tension: 40 },
  bouncy: { friction: 5, tension: 60 },
  gentle: { friction: 12, tension: 30 },
  snappy: { friction: 5, tension: 300 },
} as const;

// Stagger delays matching web card-in pattern (0.1s increments)
export const stagger = {
  interval: 100,
  delay: (index: number) => index * 100,
} as const;

// Press interaction values
export const press = {
  cardScale: 0.96,
  buttonScale: 0.97,
  bentoRotate: -4,
  bentoScale: 1.1,
  avatarScale: 1.05,
} as const;

// Confetti config
export const confetti = {
  count: 40,
  colors: ['#7c3aed', '#6366f1', '#818cf8', '#f59e0b', '#ec4899', '#10b981', '#3b82f6'],
  duration: { min: 2000, max: 3500 },
  delay: { min: 0, max: 800 },
  size: { min: 6, max: 12 },
} as const;
