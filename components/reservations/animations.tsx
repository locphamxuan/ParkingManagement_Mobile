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
export function AnimatedPressable({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress: () => void;
  style?: any;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => { scale.value = withTiming(0.96, { duration: 100 }); }}
      onPressOut={() => { scale.value = withTiming(1, { duration: 150 }); }}
      style={style}
    >
      <Animated.View style={[{ width: '100%', alignItems: 'center', justifyContent: 'center' }, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// Thẻ xuất hiện dần theo thứ tự (stagger).
export function AnimatedCard({ children, index, style }: { children: React.ReactNode; index: number; style?: any }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(15);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    opacity.value = withDelay(index * 60, withTiming(1, { duration: 400 }));
    translateY.value = withDelay(index * 60, withTiming(0, { duration: 400 }));
  }, [index]);

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
