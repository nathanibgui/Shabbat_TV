/**
 * PulsingDot — Status indicator with infinite pulse animation
 * Matches web pulse-dot keyframe (opacity + scale oscillation over 2s)
 */
import React, { useEffect } from 'react';
import { ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';

interface Props {
  color: string;
  size?: number;
  style?: ViewStyle;
  animate?: boolean;
}

export default function PulsingDot({
  color,
  size = 7,
  style,
  animate = true,
}: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (animate) {
      progress.value = withRepeat(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    }
  }, [animate]);

  const animatedStyle = useAnimatedStyle(() => {
    if (!animate) return {};
    return {
      opacity: interpolate(progress.value, [0, 0.5, 1], [1, 0.6, 1]),
      transform: [
        { scale: interpolate(progress.value, [0, 0.5, 1], [1, 0.85, 1]) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}
