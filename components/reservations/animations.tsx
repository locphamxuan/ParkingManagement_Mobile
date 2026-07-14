// AnimatedPressable/AnimatedCard: dùng bản canonical ở components/ui/AnimatedCard (bỏ bản trùng lặp).
export { AnimatedPressable, AnimatedCard } from '../ui/AnimatedCard';
import React, { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';

export interface Particle {
  id: number;
  size: number;
  color: string;
}

// Hạt lấp lánh bay toả ra rồi mờ dần (dùng khi đặt chỗ thành công).
export function GlitterParticle({ color, size }: { color: string; size: number }) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 60 + 30;
    tx.value = withTiming(Math.cos(angle) * distance, { duration: 600 });
    ty.value = withTiming(Math.sin(angle) * distance - 20, { duration: 600 });
    opacity.value = withTiming(0, { duration: 600 });
    scale.value = withTiming(0, { duration: 600 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
    position: 'absolute',
    alignSelf: 'center',
  }));

  return <Animated.View style={animatedStyle} />;
}

// Nút nhấn có hiệu ứng thu nhỏ khi bấm.

// Thẻ xuất hiện dần theo thứ tự (stagger).
