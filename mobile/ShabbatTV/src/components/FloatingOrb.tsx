/**
 * FloatingOrb — Background animated orb with continuous float
 */
import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

interface Props {
  size: number;
  color: string;
  dx?: number;
  dy?: number;
  duration?: number;
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
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loopX = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, { toValue: dx, duration: duration / 2, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: -dx * 0.7, duration: duration / 2, useNativeDriver: true }),
      ])
    );
    const loopY = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, { toValue: -dy, duration: duration * 0.4, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: dy, duration: duration * 0.6, useNativeDriver: true }),
      ])
    );
    loopX.start();
    loopY.start();
    return () => { loopX.stop(); loopY.stop(); };
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        top,
        left,
        right,
        transform: [{ translateX }, { translateY }],
      }}
    />
  );
}
