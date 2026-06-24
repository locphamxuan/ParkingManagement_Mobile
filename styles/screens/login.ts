import { StyleSheet } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '../common';

/** Login-screen-specific styles. Shared card/error/divider live in styles/common. */
export const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing['3xl'],
    gap: Spacing['2xl'],
  },
  glow: {
    position: 'absolute',
    top: -120,
    left: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(249,115,22,0.06)',
  },
  brand: { alignItems: 'center', gap: Spacing.sm },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: Radius.xl,
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: { fontSize: 36, color: Colors.primary, fontWeight: '900' },
  brandLabel: { fontSize: FontSize['2xl'], fontWeight: '900', color: Colors.text, letterSpacing: 4 },
  tagline: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  cardTitle: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.text },
  cardSub: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: -Spacing.sm },
  fields: { gap: Spacing.md },
  forgotLink: { alignSelf: 'flex-end', marginTop: -Spacing.xs },
  forgotText: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '700' },
  submitBtn: { marginTop: Spacing.xs },
  link: { alignItems: 'center' },
  linkText: { color: Colors.textMuted, fontSize: FontSize.sm },
  linkHighlight: { color: Colors.primary, fontWeight: '700' },
});
