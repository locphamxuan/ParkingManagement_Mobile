import { StyleSheet } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '../common';

export const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  inputWrapper: {
    flex: 1,
    gap: 6,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.textDim,
    letterSpacing: 1,
  },
  fieldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.cardAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    height: 40,
  },
  valueText: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  placeholderText: {
    color: Colors.textMuted,
  },
  clearBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  calendarSheet: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 340,
    gap: Spacing.md,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.sm,
  },
  modalCalTitle: {
    fontSize: FontSize.base,
    fontWeight: '800',
    color: Colors.text,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  monthLabel: {
    fontSize: FontSize.base,
    fontWeight: '800',
    color: Colors.text,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    paddingBottom: Spacing.xs,
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.textDim,
    textTransform: 'uppercase',
  },
  calGrid: {
    gap: 2,
  },
  calRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellText: {
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  selectedDayCell: {
    backgroundColor: Colors.primary,
    borderRadius: 100,
  },
  selectedDayCellText: {
    color: '#fff',
    fontWeight: '800',
  },
  todayCell: {
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  todayCellText: {
    color: Colors.primary,
    fontWeight: '800',
  },
  disabledDayCell: {
    opacity: 0.3,
  },
  disabledDayCellText: {
    color: Colors.textDim,
  },
});
