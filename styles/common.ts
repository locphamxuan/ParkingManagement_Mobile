import { StyleSheet } from 'react-native';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../constants/theme';

/**
 * Shared, reusable style fragments used across many screens and components.
 * Compose them with screen-specific styles instead of redeclaring the same
 * card / error / divider / bottom-sheet rules in every file.
 *
 * Usage:
 *   import { commonStyles as c } from '@/styles/common';
 *   <View style={c.card}>…</View>
 *   <View style={[c.card, styles.myExtra]}>…</View>
 */
export const commonStyles = StyleSheet.create({
  // ── Surfaces ───────────────────────────────────────────────────────────────
  screen: { flex: 1, backgroundColor: Colors.bg },
  /** Pure-white page — used by the authentication stack. */
  screenWhite: { flex: 1, backgroundColor: Colors.bgWhite },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing['2xl'],
    gap: Spacing.lg,
    ...Shadow.card,
  },
  cardAlt: {
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
  },

  // ── Typography helpers ───────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  /** Large navy screen title (Wallet, Profile, …). */
  pageTitle: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.text, letterSpacing: -0.3 },
  /** Small blue uppercase eyebrow shown above a page title. */
  eyebrow: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },

  // ── Segmented control (Packages tabs, Profile tabs) ──────────────────────────
  segmented: {
    flexDirection: 'row',
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  segmentActive: { backgroundColor: Colors.primary },
  segmentText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textMuted },
  segmentTextActive: { color: Colors.onPrimary, fontWeight: '800' },

  // ── Error banner ─────────────────────────────────────────────────────────────
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  errorText: { flex: 1, fontSize: FontSize.sm, color: Colors.error, fontWeight: '600' },

  // ── Success banner ───────────────────────────────────────────────────────────
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.successBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.successBorder,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  successText: { flex: 1, fontSize: FontSize.sm, color: Colors.success, fontWeight: '600' },

  // ── Dividers ─────────────────────────────────────────────────────────────────
  divider: { height: 1, backgroundColor: Colors.border },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.textDim, fontSize: FontSize.xs },

  // ── Bottom-sheet modal scaffold ──────────────────────────────────────────────
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.55)' },
  sheetContainer: { maxHeight: '85%' },
  sheetScroll: { flexGrow: 1 },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomWidth: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing['3xl'],
    gap: Spacing.md,
  },
  sheetHandleRow: { alignItems: 'center', paddingBottom: Spacing.xs },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.textDim, opacity: 0.4 },
});

// Re-export tokens so screens can import styling primitives from one place.
export { Colors, FontSize, Gradients, HIT_TARGET, Radius, Shadow, Spacing } from '../constants/theme';
