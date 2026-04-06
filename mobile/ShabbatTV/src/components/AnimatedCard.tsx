/**
 * AnimatedCard — Entry animation wrapper matching web card-in / hero-in
 * Supports staggered entrance (delay based on index)
 */
import React, { useEffect } from 'react';
import { ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { springs, stagger, entries } from '../theme/animations';

type Preset = 'cardIn' | 'heroIn' | 'notifPop';

interface Props {
  children: React.ReactNode;
  index?: number;
  preset?: Preset;
  delay?: number;
  style?: ViewStyle | ViewStyle[];
}

export default function AnimatedCard({
  children,
  index = 0,
  preset = 'cardIn',
  delay: customDelay,
  style,
}: Props) {
  const entry = entries[preset];
  const fromOpacity = 'opacity' in entry.from ? (entry.from as any).opacity : 0;
  const fromTranslateY = 'translateY' in entry.from ? (entry.from as any).translateY : 0;
  const fromScale = 'scale' in entry.from ? (entry.from as any).scale : 1;
  const toScale = 'scale' in entry.to ? (entry.to as any).scale : 1;

  const opacity = useSharedValue(fromOpacity);
  const translateY = useSharedValue(fromTranslateY);
  const scale = useSharedValue(fromScale);

  useEffect(() => {
    const d = customDelay ?? stagger.delay(index);
    opacity.value = withDelay(d, withTiming(1, { duration: entry.duration, easing: Easing.bezier(0.4, 0, 0.2, 1) }));
    translateY.value = withDelay(d, withSpring(0, springs.default));
    scale.value = withDelay(d, withSpring(toScale, springs.default));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View style={[animatedStyle, style]}>
      {children}
    </Animated.View>
  );
}
