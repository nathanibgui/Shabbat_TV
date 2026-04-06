/**
 * PulsingDot — Status indicator with infinite pulse animation
 */
import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';

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
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animate) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animate]);

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: animate ? pulse : 1,
        },
        style,
      ]}
    />
  );
}
