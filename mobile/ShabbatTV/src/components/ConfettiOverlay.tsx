/**
 * ConfettiOverlay — 40 confetti pieces falling from top
 * Uses RN Animated API (no reanimated)
 */
import React, { useEffect, useState, useRef } from 'react';
import { Animated, Dimensions, StyleSheet } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = ['#7c3aed', '#6366f1', '#818cf8', '#f59e0b', '#ec4899', '#10b981', '#3b82f6'];
const COUNT = 40;

interface Props {
  active: boolean;
  onComplete?: () => void;
}

interface PieceData {
  id: number;
  color: string;
  left: number;
  size: number;
  delay: number;
  duration: number;
  rotation: number;
  isRound: boolean;
}

function ConfettiPiece({ piece }: { piece: PieceData }) {
  const translateY = useRef(new Animated.Value(-50)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT + 50,
        duration: piece.duration,
        delay: piece.delay,
        useNativeDriver: true,
      }),
      Animated.timing(rotate, {
        toValue: piece.rotation,
        duration: piece.duration,
        delay: piece.delay,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: piece.duration * 0.3,
        delay: piece.delay + piece.duration * 0.7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const spin = rotate.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: piece.left,
        top: -20,
        width: piece.size,
        height: piece.size,
        backgroundColor: piece.color,
        borderRadius: piece.isRound ? piece.size / 2 : 2,
        opacity,
        transform: [{ translateY }, { rotate: spin }],
      }}
    />
  );
}

export default function ConfettiOverlay({ active, onComplete }: Props) {
  const [pieces, setPieces] = useState<PieceData[]>([]);

  useEffect(() => {
    if (!active) { setPieces([]); return; }

    const newPieces: PieceData[] = Array.from({ length: COUNT }, (_, i) => ({
      id: i,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      left: Math.random() * SCREEN_WIDTH,
      size: 6 + Math.random() * 6,
      delay: Math.random() * 800,
      duration: 2000 + Math.random() * 1500,
      rotation: 360 + Math.random() * 360,
      isRound: Math.random() > 0.5,
    }));
    setPieces(newPieces);

    const timer = setTimeout(() => {
      setPieces([]);
      onComplete?.();
    }, 3800);
    return () => clearTimeout(timer);
  }, [active]);

  if (pieces.length === 0) return null;

  return (
    <>
      {pieces.map((p) => <ConfettiPiece key={p.id} piece={p} />)}
    </>
  );
}
