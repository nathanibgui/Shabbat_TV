/**
 * GlowingBadge — Badge with pulsing background glow
 */
import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';

interface Props {
  children: React.ReactNode;
  active?: boolean;
  style?: ViewStyle;
}

export default function GlowingBadge({ children, active = true, style }: Props) {
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1000, useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0, duration: 1000, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active]);

  const bgColor = active
    ? glow.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.30)'],
      })
    : 'rgba(255,255,255,0.15)';

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
          backgroundColor: bgColor,
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
