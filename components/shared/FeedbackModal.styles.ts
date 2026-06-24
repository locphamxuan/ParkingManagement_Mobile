import { StyleSheet } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '../../styles/common';

/** Styles specific to FeedbackModal. Shared scaffolding lives in styles/common + SheetModal. */
export const styles = StyleSheet.create({
  title: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.text, textAlign: 'center' },
  subtitle: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '600', textAlign: 'center' },
  starsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs },
  starBtn: { padding: Spacing.xs },
  ratingLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.amber,
    marginLeft: Spacing.sm,
    minWidth: 40,
  },
  textareaWrapper: {
    backgroundColor: Colors.input,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  textarea: {
    color: Colors.text,
    fontSize: FontSize.base,
    minHeight: 80,
    textAlignVertical: 'top',
    paddingVertical: 0,
  },
  counter: { textAlign: 'right', fontSize: FontSize.xs, color: Colors.textDim, fontWeight: '700', marginTop: 2 },
  counterWarn: { color: Colors.error },
  actionsRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  cancelLabel: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.textMuted, letterSpacing: 1 },
  submitBtn: {
    flex: 2,
    height: 48,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  submitInline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  submitBtnDisabled: { opacity: 0.5 },
  submitLabel: { fontSize: FontSize.xs, fontWeight: '900', color: '#020617', letterSpacing: 1 },
});
