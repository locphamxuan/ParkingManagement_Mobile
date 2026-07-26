import React from 'react';
import { Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay } from 'react-native-reanimated';

/**
 * Hai wrapper animation dùng chung nhiều màn (Home/Wallet/Profile/Packages):
 * - AnimatedPressable: nhấn co nhẹ (scale).
 * - AnimatedCard: fade + trượt lên theo index (stagger).
 */
export function AnimatedPressable({
  children,
  onPress,
  style,
  contentStyle,
  fullWidth = true,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress: () => void;
  style?: any;
  /** Style áp lên Animated.View bên trong (bản local cũ ở Home có prop này). */
  contentStyle?: any;
  fullWidth?: boolean;
  accessibilityLabel?: string;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.96, { duration: 100 });
  };
  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 150 });
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[
        { alignItems: 'center', justifyContent: 'center' },
        fullWidth && { width: '100%' },
        contentStyle,
        animatedStyle
      ]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export function AnimatedCard({ children, index, style }: { children: React.ReactNode; index: number; style?: any }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(15);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  React.useEffect(() => {
    opacity.value = withDelay(index * 60, withTiming(1, { duration: 400 }));
    translateY.value = withDelay(index * 60, withTiming(0, { duration: 400 }));
  }, [index]);

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
