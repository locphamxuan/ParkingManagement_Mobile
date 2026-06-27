import { StyleSheet } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '../common';

/** Register-screen-specific styles. Shared card/error live in styles/common. */
export const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing['2xl'],
    gap: Spacing.xl,
  },
  backBtn: { alignSelf: 'flex-start' },
  backText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '700' },
  brand: { alignItems: 'center', gap: Spacing.sm },
  logoBox: {
    width: 60,
    height: 60,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(14,165,233,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: { fontSize: 30, color: Colors.primary, fontWeight: '900' },
  brandLabel: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.text, letterSpacing: 4 },
  cardTitle: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.text },
  cardSub: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: -Spacing.sm },
  fields: { gap: Spacing.md },
  submitBtn: { marginTop: Spacing.xs },
  link: { alignItems: 'center' },
  linkText: { color: Colors.textMuted, fontSize: FontSize.sm },
  linkHighlight: { color: Colors.primary, fontWeight: '700' },
  note: { color: Colors.textDim, fontSize: FontSize.xs, textAlign: 'center' },
});
