import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Colors, Radius, FontSize } from '../../constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

const variantStyle: Record<Variant, { bg: string; border: string; text: string }> = {
  primary: { bg: Colors.primary, border: 'transparent', text: '#020617' },
  secondary: { bg: Colors.cardAlt, border: Colors.border, text: Colors.text },
  ghost: { bg: 'transparent', border: Colors.border, text: Colors.textMuted },
  danger: { bg: Colors.errorBg, border: Colors.errorBorder, text: Colors.error },
  success: { bg: Colors.successBg, border: Colors.successBorder, text: Colors.success },
};

const sizeStyle: Record<Size, { height: number; px: number; fontSize: number }> = {
  sm: { height: 36, px: 14, fontSize: FontSize.xs },
  md: { height: 44, px: 18, fontSize: FontSize.sm },
  lg: { height: 52, px: 22, fontSize: FontSize.base },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  fullWidth = false,
}: ButtonProps) {
  const vs = variantStyle[variant];
  const ss = sizeStyle[size];
  const isDisabled = disabled || loading;

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!isDisabled) scale.value = withTiming(0.97, { duration: 100 });
  };
  const handlePressOut = () => {
    if (!isDisabled) scale.value = withTiming(1, { duration: 150 });
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      style={[
        {
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.base,
          {
            backgroundColor: vs.bg,
            borderColor: vs.border,
            height: ss.height,
            paddingHorizontal: ss.px,
            opacity: isDisabled ? 0.55 : 1,
            width: fullWidth ? '100%' : undefined,
          },
          animatedStyle,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={vs.text} />
        ) : (
          <Text
            style={[
              styles.label,
              { color: vs.text, fontSize: ss.fontSize },
              textStyle,
            ]}
          >
            {label}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
