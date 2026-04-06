/**
 * Animation configs aligned with app.html web design
 * Uses react-native-reanimated spring/timing configs
 */
import { Easing } from 'react-native-reanimated';

// Spring configs matching web CSS cubic-bezier curves
export const springs = {
  /** Default spring — matches var(--spring): cubic-bezier(0.34, 1.56, 0.64, 1) */
  default: {
    damping: 12,
    stiffness: 180,
    mass: 1,
  },
  /** Bouncy spring — matches var(--bounce): cubic-bezier(0.68, -0.6, 0.32, 1.6) */
  bouncy: {
    damping: 8,
    stiffness: 200,
    mass: 0.8,
  },
  /** Gentle spring for subtle animations */
  gentle: {
    damping: 20,
    stiffness: 120,
    mass: 1,
  },
  /** Snappy for quick interactions */
  snappy: {
    damping: 15,
    stiffness: 300,
    mass: 0.8,
  },
} as const;

// Timing configs matching web CSS transitions
export const timings = {
  /** Standard ease — var(--ease): cubic-bezier(0.4, 0, 0.2, 1) */
  ease: {
    duration: 250,
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  },
  /** Sheet slide up — cubic-bezier(0.32, 0.72, 0, 1) */
  sheetUp: {
    duration: 350,
    easing: Easing.bezier(0.32, 0.72, 0, 1),
  },
  /** Slow float for orbs/background elements */
  float: {
    duration: 15000,
    easing: Easing.inOut(Easing.ease),
  },
  /** Pulse for status dots, badges */
  pulse: {
    duration: 2000,
    easing: Easing.inOut(Easing.ease),
  },
  /** Shimmer sweep */
  shimmer: {
    duration: 1500,
    easing: Easing.linear,
  },
  /** Badge glow */
  glow: {
    duration: 2000,
    easing: Easing.inOut(Easing.ease),
  },
} as const;

// Stagger delays matching web card-in pattern (0.1s increments)
export const stagger = {
  /** Delay between staggered items in ms */
  interval: 100,
  /** Calculate delay for item at index */
  delay: (index: number) => index * 100,
} as const;

// Entry animation presets (from → to values)
export const entries = {
  /** hero-in: opacity 0→1, translateY 20→0, scale 0.97→1 */
  heroIn: {
    from: { opacity: 0, translateY: 20, scale: 0.97 },
    to: { opacity: 1, translateY: 0, scale: 1 },
    duration: 800,
  },
  /** card-in: opacity 0→1, translateY 24→0, scale 0.96→1 */
  cardIn: {
    from: { opacity: 0, translateY: 24, scale: 0.96 },
    to: { opacity: 1, translateY: 0, scale: 1 },
    duration: 500,
  },
  /** notif-pop: opacity 0→1, scale 0.8→1, translateY 10→0 */
  notifPop: {
    from: { opacity: 0, scale: 0.8, translateY: 10 },
    to: { opacity: 1, scale: 1, translateY: 0 },
    duration: 500,
  },
  /** sheet-up: translateY 100%→0 */
  sheetUp: {
    from: { translateY: 600 },
    to: { translateY: 0 },
    duration: 350,
  },
} as const;

// Press interaction values
export const press = {
  /** Card press scale (web: scale(0.96)) */
  cardScale: 0.96,
  /** Button press scale (web: scale(0.97)) */
  buttonScale: 0.97,
  /** Bento icon rotation on press */
  bentoRotate: -4, // degrees
  /** Bento icon scale on press */
  bentoScale: 1.1,
  /** Avatar scale on tap */
  avatarScale: 1.05,
} as const;

// Confetti config matching web launchConfetti()
export const confetti = {
  count: 40,
  colors: ['#7c3aed', '#6366f1', '#818cf8', '#f59e0b', '#ec4899', '#10b981', '#3b82f6'],
  duration: { min: 2000, max: 3500 },
  delay: { min: 0, max: 800 },
  size: { min: 6, max: 12 },
} as const;
