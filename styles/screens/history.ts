import { StyleSheet } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '../common';

/** History-screen-specific styles. Shared screen/card/error/divider live in styles/common. */
export const styles = StyleSheet.create({
  scroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: 32, gap: Spacing.lg },
  pageTitle: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.text },
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing['2xl'],
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyText: { color: Colors.textDim, fontSize: FontSize.sm },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  plateTxt: { fontSize: FontSize.base, fontWeight: '800', color: Colors.text, fontFamily: 'monospace' },
  subTxt: { fontSize: FontSize.xs, color: Colors.textMuted },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  infoCell: { minWidth: '40%', gap: 3 },
  infoLabel: { fontSize: 9, fontWeight: '800', color: Colors.textDim, textTransform: 'uppercase', letterSpacing: 1 },
  infoValue: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted },
  feedbackBtn: {
    marginTop: Spacing.xs,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  feedbackBtnText: {
    color: '#ffffff',
    fontSize: FontSize.xs,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
