/**
 * SkeletonLoader — Shimmer loading placeholder matching web skel-shimmer
 * Animated gradient sweep that runs while content loads
 */
import React, { useEffect } from 'react';
import { View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../hooks/useTheme';

interface Props {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export default function SkeletonLoader({
  width = '100%',
  height = 20,
  borderRadius = 10,
  style,
}: Props) {
  const { theme, isDark } = useTheme();
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(shimmer.value, [0, 1], [-300, 300]),
      },
    ],
  }));

  const baseColor = isDark ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.06)';
  const highlightColor = isDark ? 'rgba(139,92,246,0.15)' : 'rgba(124,58,237,0.1)';

  return (
    <View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: baseColor,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View style={[{ width: 300, height: '100%' }, animatedStyle]}>
        <LinearGradient
          colors={['transparent', highlightColor, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

/** Preset skeleton layouts */
export function SkeletonHero() {
  return (
    <View style={{ padding: 30, gap: 12 }}>
      <SkeletonLoader width={120} height={14} borderRadius={7} />
      <SkeletonLoader width="70%" height={30} borderRadius={10} />
      <View style={{ flexDirection: 'row', gap: 24, marginTop: 8 }}>
        <View style={{ gap: 6 }}>
          <SkeletonLoader width={80} height={10} borderRadius={5} />
          <SkeletonLoader width={60} height={26} borderRadius={8} />
        </View>
        <View style={{ gap: 6 }}>
          <SkeletonLoader width={80} height={10} borderRadius={5} />
          <SkeletonLoader width={60} height={26} borderRadius={8} />
        </View>
      </View>
    </View>
  );
}

export function SkeletonDeviceCard() {
  return (
    <View style={{ padding: 22, gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <SkeletonLoader width={50} height={50} borderRadius={16} />
        <View style={{ gap: 6, flex: 1 }}>
          <SkeletonLoader width="60%" height={16} borderRadius={8} />
          <SkeletonLoader width="40%" height={12} borderRadius={6} />
        </View>
      </View>
      <SkeletonLoader width="100%" height={36} borderRadius={10} />
    </View>
  );
}
