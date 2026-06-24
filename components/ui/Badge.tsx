import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, Radius } from '../../constants/theme';

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'default' | 'orange' | 'purple';

const variantMap: Record<BadgeVariant, { bg: string; border: string; text: string }> = {
  success: { bg: Colors.successBg, border: Colors.successBorder, text: Colors.success },
  error: { bg: Colors.errorBg, border: Colors.errorBorder, text: Colors.error },
  warning: { bg: Colors.warningBg, border: Colors.warningBorder, text: Colors.warning },
  info: { bg: Colors.blueBg, border: 'rgba(59,130,246,0.25)', text: Colors.blue },
  default: { bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.25)', text: Colors.textMuted },
  orange: { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.25)', text: Colors.primary },
  purple: { bg: Colors.purpleBg, border: 'rgba(168,85,247,0.25)', text: Colors.purple },
};

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

export function Badge({ label, variant = 'default' }: BadgeProps) {
  const v = variantMap[variant];
  return (
    <View style={[styles.badge, { backgroundColor: v.bg, borderColor: v.border }]}>
      <Text style={[styles.text, { color: v.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
