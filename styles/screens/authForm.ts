import { StyleSheet } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '../common';

/**
 * Shared styles for the white "daylight" authentication pages
 * (register, forgot password, forgot password via SMS, reset password, OTP).
 * Login has its own gradient-header layout in ./login.
 */
export const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.lg,
    paddingBottom: Spacing['3xl'],
    gap: Spacing.xl,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', minHeight: 44, paddingRight: Spacing.md },
  backText: { color: Colors.primary, fontSize: FontSize.base, fontWeight: '700' },
  brand: { alignItems: 'center', gap: Spacing.md },
  cardTitle: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.text, textAlign: 'center' },
  cardSub: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.md,
  },
  fields: { gap: Spacing.lg },
  submitBtn: { marginTop: Spacing.xs },
  link: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  linkText: { color: Colors.textMuted, fontSize: FontSize.sm },
  linkHighlight: { color: Colors.primary, fontWeight: '700' },
  note: { color: Colors.textDim, fontSize: FontSize.xs, textAlign: 'center' },
});

/** Confirmation modal styles (forgot-password "send reset link?" dialog). */
export const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
  },
  container: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing['2xl'],
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '900',
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
    minHeight: 44,
    justifyContent: 'center',
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
    color: Colors.onPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
