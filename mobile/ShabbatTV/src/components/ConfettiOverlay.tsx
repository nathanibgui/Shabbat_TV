/**
 * ConfettiOverlay — 40 confetti pieces falling from top, matching web launchConfetti()
 * Triggered on Shabbat mode activation, successful pairing, etc.
 */
import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { confetti as config } from '../theme/animations';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  active: boolean;
  onComplete?: () => void;
}

interface Piece {
  id: number;
  color: string;
  left: number;
  size: number;
  delay: number;
  duration: number;
  rotation: number;
}

function ConfettiPiece({ piece }: { piece: Piece }) {
  const translateY = useSharedValue(-50);
  const opacity = useSharedValue(1);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    translateY.value = withDelay(
      piece.delay,
      withTiming(SCREEN_HEIGHT + 50, {
        duration: piece.duration,
        easing: Easing.in(Easing.ease),
      })
    );
    rotate.value = withDelay(
      piece.delay,
      withTiming(piece.rotation, {
        duration: piece.duration,
        easing: Easing.linear,
      })
    );
    opacity.value = withDelay(
      piece.delay + piece.duration * 0.7,
      withTiming(0, { duration: piece.duration * 0.3 })
    );
    scale.value = withDelay(
      piece.delay,
      withTiming(0.5, { duration: piece.duration, easing: Easing.in(Easing.ease) })
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const isRound = Math.random() > 0.5;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: piece.left,
          top: -20,
          width: piece.size,
          height: piece.size,
          backgroundColor: piece.color,
          borderRadius: isRound ? piece.size / 2 : 2,
        },
        style,
      ]}
    />
  );
}

export default function ConfettiOverlay({ active, onComplete }: Props) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (!active) {
      setPieces([]);
      return;
    }

    const newPieces: Piece[] = Array.from({ length: config.count }, (_, i) => ({
      id: i,
      color: config.colors[Math.floor(Math.random() * config.colors.length)],
      left: Math.random() * SCREEN_WIDTH,
      size: config.size.min + Math.random() * (config.size.max - config.size.min),
      delay: Math.random() * config.delay.max,
      duration: config.duration.min + Math.random() * (config.duration.max - config.duration.min),
      rotation: 360 + Math.random() * 360,
    }));
    setPieces(newPieces);

    // Auto cleanup
    const maxDuration = config.duration.max + config.delay.max;
    const timer = setTimeout(() => {
      setPieces([]);
      onComplete?.();
    }, maxDuration + 200);

    return () => clearTimeout(timer);
  }, [active]);

  if (pieces.length === 0) return null;

  return (
    <>
      {pieces.map((piece) => (
        <ConfettiPiece key={piece.id} piece={piece} />
      ))}
    </>
  );
}
