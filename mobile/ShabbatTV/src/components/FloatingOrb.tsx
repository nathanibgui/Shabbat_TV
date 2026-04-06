/**
 * FloatingOrb — Background animated orb matching web hero-orb keyframe
 * Floats continuously with translate animation (15-18s cycle)
 */
import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface Props {
  size: number;
  color: string;
  /** Horizontal offset range */
  dx?: number;
  /** Vertical offset range */
  dy?: number;
  /** Animation cycle duration in ms */
  duration?: number;
  /** Starting position */
  top?: number;
  left?: number;
  right?: number;
}

export default function FloatingOrb({
  size,
  color,
  dx = 30,
  dy = 20,
  duration = 15000,
  top,
  left,
  right,
}: Props) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    const ease = Easing.inOut(Easing.ease);
    const halfDur = duration / 2;

    translateX.value = withRepeat(
      withSequence(
        withTiming(dx, { duration: halfDur, easing: ease }),
        withTiming(-dx * 0.7, { duration: halfDur, easing: ease }),
      ),
      -1,
      true
    );
    translateY.value = withRepeat(
      withSequence(
        withTiming(-dy, { duration: halfDur * 0.8, easing: ease }),
        withTiming(dy, { duration: halfDur * 1.2, easing: ease }),
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          top,
          left,
          right,
        },
        animatedStyle,
      ]}
    />
  );
}
