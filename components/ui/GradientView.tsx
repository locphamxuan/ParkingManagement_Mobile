import React, { useId, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

type Direction = 'diagonal' | 'horizontal' | 'vertical';

const DIRECTION_VECTOR: Record<Direction, { x2: string; y2: string }> = {
  diagonal: { x2: '1', y2: '1' },
  horizontal: { x2: '1', y2: '0' },
  vertical: { x2: '0', y2: '1' },
};

interface GradientViewProps {
  /** Two or more stop colours, first → last. */
  colors: readonly string[];
  direction?: Direction;
  /** Radius applied to the clipped gradient layer; mirror it in `style`. */
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  pointerEvents?: ViewStyle['pointerEvents'];
}

/**
 * Linear-gradient background built on react-native-svg (already a dependency —
 * no expo-linear-gradient needed). The first colour doubles as a solid
 * fallback so nothing flashes before the first layout pass.
 */
export function GradientView({
  colors,
  direction = 'diagonal',
  borderRadius = 0,
  style,
  children,
  pointerEvents,
}: GradientViewProps) {
  const gradientId = `grad-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [size, setSize] = useState({ width: 0, height: 0 });
  const vector = DIRECTION_VECTOR[direction];

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
  };

  return (
    <View
      style={[{ backgroundColor: colors[0], borderRadius, overflow: 'hidden' }, style]}
      onLayout={handleLayout}
      pointerEvents={pointerEvents}
    >
      {size.width > 0 && size.height > 0 ? (
        <Svg style={StyleSheet.absoluteFill} width={size.width} height={size.height}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2={vector.x2} y2={vector.y2}>
              {colors.map((color, i) => (
                <Stop key={color + i} offset={`${(i / (colors.length - 1)) * 100}%`} stopColor={color} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={size.width} height={size.height} fill={`url(#${gradientId})`} />
        </Svg>
      ) : null}
      {children}
    </View>
  );
}
