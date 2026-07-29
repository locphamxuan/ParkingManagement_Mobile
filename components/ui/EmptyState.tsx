import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';

/**
 * Empty state dùng chung — trước đây 6 màn (history/packages/wallet/
 * packages/profile/buildings) mỗi màn tự vẽ emptyCard/emptyText một kiểu.
 */
export function EmptyState({
  icon = 'file-tray-outline',
  title,
  subtitle,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.card}>
      <Ionicons name={icon} size={32} color={Colors.textDim} />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingVertical: Spacing['2xl'],
    paddingHorizontal: Spacing.lg,
  },
  title: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.textDim,
    fontSize: FontSize.xs,
    textAlign: 'center',
  },
});
