/**
 * PressableScale — TouchableOpacity replacement with spring-based scale animation
 * Matches web card:active { transform: scale(0.96) } with spring easing
 */
import React from 'react';
import { ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { springs, press } from '../theme/animations';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  scale?: number;
  style?: ViewStyle | ViewStyle[];
  disabled?: boolean;
}

export default function PressableScale({
  children,
  onPress,
  scale: pressScale = press.cardScale,
  style,
  disabled = false,
}: Props) {
  const scaleValue = useSharedValue(1);

  const gesture = Gesture.Tap()
    .enabled(!disabled)
    .onBegin(() => {
      scaleValue.value = withSpring(pressScale, springs.snappy);
    })
    .onFinalize(() => {
      scaleValue.value = withSpring(1, springs.default);
    })
    .onEnd(() => {
      if (onPress) {
        onPress();
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[animatedStyle, style]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
