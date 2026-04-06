/**
 * GlowingBadge — Badge with pulsing glow animation
 * Matches web badge-glow keyframe (background oscillation over 2s)
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
  interpolateColor,
} from 'react-native-reanimated';

interface Props {
  children: React.ReactNode;
  active?: boolean;
  style?: ViewStyle;
}

export default function GlowingBadge({ children, active = true, style }: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (active) {
      progress.value = withRepeat(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    }
  }, [active]);

  const animatedStyle = useAnimatedStyle(() => {
    if (!active) return { backgroundColor: 'rgba(255,255,255,0.15)' };
    return {
      backgroundColor: interpolateColor(
        progress.value,
        [0, 0.5, 1],
        ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.28)', 'rgba(255,255,255,0.18)']
      ),
    };
  });

  return (
    <Animated.View
      style={[
        {
          paddingHorizontal: 18,
          paddingVertical: 10,
          borderRadius: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          alignSelf: 'flex-start',
        },
        animatedStyle,
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
