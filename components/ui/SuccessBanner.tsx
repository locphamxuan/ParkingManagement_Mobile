import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { commonStyles, Colors } from '../../styles/common';

interface SuccessBannerProps {
  message?: string | null;
  hideIcon?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Shared green success banner used by forms, modals and screens. */
export function SuccessBanner({ message, hideIcon, style }: SuccessBannerProps) {
  if (!message) return null;
  return (
    <View style={[commonStyles.successBox, style]}>
      {!hideIcon && <Ionicons name="checkmark-circle" size={16} color={Colors.success} />}
      <Text style={commonStyles.successText}>{message}</Text>
    </View>
  );
}

export default SuccessBanner;
