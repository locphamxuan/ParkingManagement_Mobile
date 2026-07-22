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

/** Confirmation modal styles (forgot-password "send reset link?" dialog). */
export const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
  },
  container: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing['2xl'],
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  body: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing['2xl'],
  },
  emailHighlight: {
    color: Colors.primary,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  btn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  btnCancel: {
    backgroundColor: Colors.cardAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnCancelText: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  btnConfirm: {
    backgroundColor: Colors.primary,
  },
  btnConfirmText: {
    color: '#ffffff',
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
