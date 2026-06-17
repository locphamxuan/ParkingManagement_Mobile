import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { commonStyles, Colors } from '../../styles/common';

interface ErrorBannerProps {
  /** Message to show. Renders nothing when empty/null. */
  message?: string | null;
  /** Hide the leading alert icon. */
  hideIcon?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Shared red error banner used by forms, modals and screens. */
export function ErrorBanner({ message, hideIcon, style }: ErrorBannerProps) {
  if (!message) return null;
  return (
    <View style={[commonStyles.errorBox, style]}>
      {!hideIcon && <Ionicons name="alert-circle" size={16} color={Colors.error} />}
      <Text style={commonStyles.errorText}>{message}</Text>
    </View>
  );
}

export default ErrorBanner;
