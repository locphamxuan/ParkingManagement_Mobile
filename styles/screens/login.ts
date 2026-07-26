import { StyleSheet } from 'react-native';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../common';

/** Login screen — blue gradient welcome band above a rounded white form surface. */
export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgWhite },
  scroll: { flexGrow: 1, backgroundColor: Colors.bgWhite },

  // ── Gradient welcome band ──────────────────────────────────────────────────
  hero: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing['3xl'] + Spacing.xl,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  heroCopy: { flex: 1 },
  heroTitle: { fontSize: FontSize.xl, fontWeight: '900', color: '#ffffff', letterSpacing: -0.2 },
  heroSub: { fontSize: FontSize.sm, fontWeight: '600', color: '#ffffff', marginTop: 4 },
  heroCta: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.xl,
  },
  heroCtaText: { color: '#ffffff', fontWeight: '800', fontSize: FontSize.sm },

  // ── White form surface, pulled up over the band ────────────────────────────
  form: {
    flex: 1,
    backgroundColor: Colors.bgWhite,
    borderTopLeftRadius: Radius.xl + 8,
    borderTopRightRadius: Radius.xl + 8,
    marginTop: -Spacing['3xl'],
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing['3xl'],
    gap: Spacing.xl,
  },
  brand: { alignItems: 'center', gap: Spacing.md },
  title: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.text },
  fields: { gap: Spacing.lg },
  forgotLink: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' },
  forgotText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '700' },
  submitBtn: { marginTop: Spacing.xs },

  // ── Social sign-in ─────────────────────────────────────────────────────────
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  socialRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.lg },
  socialBtn: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
  },
});
