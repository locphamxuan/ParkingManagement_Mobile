import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../store/authStore';
import {
  getManagerBuildings,
  getShiftRevenues,
  type ManagerBuilding,
  type ShiftRevenueItem,
} from '../../../services/manager';
import { Card } from '../../../components/ui/Card';
import { Colors, FontSize, Radius, Spacing } from '../../../constants/theme';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatVND(amount: number | null | undefined): string {
  const safe = amount ?? 0;
  if (safe === 0) return '0';
  return new Intl.NumberFormat('vi-VN', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(safe);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatWorkDate(workDate: string | null | undefined): string {
  if (!workDate) return '—';
  // workDate is likely "YYYY-MM-DD"
  const parts = workDate.split('-');
  if (parts.length !== 3) return workDate;
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const month = monthNames[Number(parts[1]) - 1] || parts[1];
  return `${month} ${Number(parts[2])}, ${parts[0]}`;
}

function formatTime(isoOrTime: string | null | undefined): string {
  if (!isoOrTime) return '—';
  if (/^\d{2}:\d{2}$/.test(isoOrTime)) return isoOrTime;
  const d = new Date(isoOrTime);
  if (!isNaN(d.getTime())) {
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
  return isoOrTime;
}

// ─── Payment Badge ───────────────────────────────────────────────────────────

interface PaymentBadgeProps {
  label: string;
  amount: number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
}

function PaymentBadge({ label, amount, icon, color, bg }: PaymentBadgeProps) {
  return (
    <View style={[styles.paymentBadge, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={13} color={color} />
      <Text style={[styles.paymentBadgeLabel, { color }]}>{label}</Text>
      <Text style={[styles.paymentBadgeAmount, { color }]}>
        {formatVND(amount)}đ
      </Text>
    </View>
  );
}

// ─── Shift Revenue Card ──────────────────────────────────────────────────────

interface ShiftRevenueCardProps {
  item: ShiftRevenueItem;
}

function ShiftRevenueCard({ item }: ShiftRevenueCardProps) {
  const isReconciled = item.reconciled;
  const shiftTime = `${formatTime(item.shift.startTime)} - ${formatTime(item.shift.endTime)}`;

  return (
    <Card style={styles.revenueCard} padding={Spacing.lg}>
      {/* Header: Staff + Date */}
      <View style={styles.cardHeader}>
        <View style={styles.staffAvatar}>
          <Ionicons name="person-outline" size={20} color={Colors.text} />
        </View>
        <View style={styles.cardHeaderInfo}>
          <Text style={styles.staffName} numberOfLines={1}>
            {item.staff.fullName}
          </Text>
          <Text style={styles.workDate}>
            {formatWorkDate(item.workDate)}
          </Text>
        </View>

        {/* Reconciled / Pending Badge */}
        <View
          style={[
            styles.reconciledBadge,
            isReconciled
              ? styles.reconciledBadgeTrue
              : styles.reconciledBadgeFalse,
          ]}
        >
          <Ionicons
            name={isReconciled ? 'shield-checkmark-outline' : 'time-outline'}
            size={13}
            color={isReconciled ? Colors.success : Colors.warning}
          />
          <Text
            style={[
              styles.reconciledBadgeText,
              { color: isReconciled ? Colors.success : Colors.warning },
            ]}
          >
            {isReconciled ? 'Audited' : 'Pending'}
          </Text>
        </View>
      </View>

      {/* Shift Info */}
      <View style={styles.shiftInfoRow}>
        <Ionicons name="timer-outline" size={14} color={Colors.textMuted} />
        <Text style={styles.shiftInfoText}>
          {item.shift.name}
        </Text>
        {shiftTime ? (
          <Text style={styles.shiftTimeText}>{shiftTime}</Text>
        ) : null}
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Total Revenue */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total Revenue</Text>
        <Text style={styles.totalAmount}>{formatVND(item.totalRevenue)}đ</Text>
      </View>

      {/* Sessions */}
      <View style={styles.sessionRow}>
        <Ionicons name="receipt-outline" size={14} color={Colors.textDim} />
        <Text style={styles.sessionLabel}>Sessions Logged</Text>
        <View style={styles.sessionCountBox}>
          <Text style={styles.sessionCount}>{item.sessionCount}</Text>
        </View>
      </View>

      {/* Payment Method Breakdown */}
      <View style={styles.paymentBreakdown}>
        <PaymentBadge
          label="Cash"
          amount={item.cashAmount}
          icon="cash-outline"
          color={Colors.success}
          bg={Colors.successBg}
        />
        <PaymentBadge
          label="Wallet"
          amount={item.walletAmount}
          icon="wallet-outline"
          color={Colors.blue}
          bg={Colors.blueBg}
        />
        <PaymentBadge
          label="QR"
          amount={item.qrAmount}
          icon="qr-code-outline"
          color={Colors.purple}
          bg={Colors.purpleBg}
        />
      </View>

      {/* Footer: created time */}
      <View style={styles.cardFooter}>
        <Ionicons name="time-outline" size={12} color={Colors.textDim} />
        <Text style={styles.cardFooterText}>
          Submitted {formatDate(item.createdAt)}
        </Text>
      </View>
    </Card>
  );
}

// ─── Summary Card ────────────────────────────────────────────────────────────

interface SummaryCardProps {
  items: ShiftRevenueItem[];
}

function SummaryCard({ items }: SummaryCardProps) {
  const totalRevenue = items.reduce((sum, i) => sum + i.totalRevenue, 0);
  const totalSessions = items.reduce((sum, i) => sum + i.sessionCount, 0);
  const totalCash = items.reduce((sum, i) => sum + i.cashAmount, 0);
  const totalWallet = items.reduce((sum, i) => sum + i.walletAmount, 0);
  const totalQr = items.reduce((sum, i) => sum + i.qrAmount, 0);
  const reconciledCount = items.filter((i) => i.reconciled).length;
  const pendingCount = items.length - reconciledCount;

  return (
    <Card style={styles.summaryCard} padding={Spacing.lg}>
      <View style={styles.summaryHeaderRow}>
        <Ionicons name="stats-chart-outline" size={16} color={Colors.primary} />
        <Text style={styles.summaryTitle}>Revenue Summary</Text>
        <View style={styles.summaryReconciledRow}>
          <View
            style={[styles.summaryDot, { backgroundColor: Colors.success }]}
          />
          <Text style={styles.summaryReconciledText}>
            {reconciledCount} audited
          </Text>
          {pendingCount > 0 && (
            <>
              <View
                style={[styles.summaryDot, { backgroundColor: Colors.warning }]}
              />
              <Text style={styles.summaryReconciledText}>
                {pendingCount} pending
              </Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Revenue</Text>
          <Text style={styles.summaryValue}>{formatVND(totalRevenue)}đ</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Sessions</Text>
          <Text style={styles.summaryValue}>{totalSessions}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Cash</Text>
          <Text style={styles.summaryValueSm}>{formatVND(totalCash)}đ</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Wallet</Text>
          <Text style={styles.summaryValueSm}>{formatVND(totalWallet)}đ</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>QR</Text>
          <Text style={styles.summaryValueSm}>{formatVND(totalQr)}đ</Text>
        </View>
      </View>
    </Card>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const router = useRouter();
  const { session } = useAuthStore();
  const token = session?.token ?? '';

  // State
  const [building, setBuilding] = useState<ManagerBuilding | null>(null);
  const [revenues, setRevenues] = useState<ShiftRevenueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Safe array unwrapper ──────────────────────────────────────────────────
  // Backend may return either { data: [...] } or { data: { items: [...] } }.
  const toArray = useCallback((val: unknown): any[] => {
    if (Array.isArray(val)) return val;
    if (val && typeof val === 'object' && 'items' in (val as object) && Array.isArray((val as Record<string, unknown>).items)) {
      return (val as Record<string, unknown>).items as any[];
    }
    return [];
  }, []);

  // ── Fetch Data ────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!token) return;
    setError(null);

    try {
      // 1. Fetch building
      const buildingsRes = await getManagerBuildings(token);
      const buildings = Array.isArray(buildingsRes?.data) ? buildingsRes.data : [];

      if (buildings.length === 0) {
        setBuilding(null);
        setRevenues([]);
        return;
      }

      const bld = buildings[0];
      setBuilding(bld);

      // 2. Fetch shift revenues
      const revRes = await getShiftRevenues(bld._id, token);
      setRevenues(toArray(revRes?.data));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load shift revenues';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, toArray]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // ── Sort: unreconciled first, then by createdAt descending ────────────────

  const sortedRevenues = React.useMemo(() => {
    const safe = Array.isArray(revenues) ? revenues : [];
    return [...safe].sort((a, b) => {
      // Unreconciled (pending) first
      if (a.reconciled !== b.reconciled) {
        return a.reconciled ? 1 : -1;
      }
      // Then by createdAt descending (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [revenues]);

  // ── Render: Loading ───────────────────────────────────────────────────────

  if (loading && !building) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading shift revenues…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        >
          {/* Glow decoration */}
          <View style={styles.glow} pointerEvents="none" />

          {/* ── Header ──────────────────────────────────────────────────── */}
          <View style={styles.headerSection}>
            <Text style={styles.pageTitle}>Shift Audits</Text>
            <Text style={styles.pageSubtitle}>
              Review and audit staff revenue submissions per shift
            </Text>
          </View>

          {/* ── Error banner ────────────────────────────────────────────── */}
          {error && (
            <View style={styles.errorBanner}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={Colors.error}
              />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* ── No building fallback ────────────────────────────────────── */}
          {!building && !loading && !error && (
            <View style={styles.emptyBox}>
              <Ionicons
                name="business-outline"
                size={48}
                color={Colors.textDim}
              />
              <Text style={styles.emptyTitle}>No Building Assigned</Text>
              <Text style={styles.emptyText}>
                You don't have any building assigned to your account yet.
              </Text>
            </View>
          )}

          {building && !loading && (
            <>
              {/* ── Summary Card ──────────────────────────────────────── */}
              {revenues.length > 0 && <SummaryCard items={revenues} />}

              {/* ── Section Header ────────────────────────────────────── */}
              <View style={styles.sectionHeader}>
                <Ionicons
                  name="receipt-outline"
                  size={18}
                  color={Colors.primary}
                />
                <Text style={styles.sectionTitle}>Shift Reports</Text>
                <Text style={styles.sectionCount}>
                  {revenues.length} report{revenues.length !== 1 ? 's' : ''}
                </Text>
              </View>

              {/* ── Revenue List ───────────────────────────────────────── */}
              {sortedRevenues.length === 0 ? (
                <View style={styles.emptyRevenuesBox}>
                  <Ionicons
                    name="document-text-outline"
                    size={42}
                    color={Colors.textDim}
                  />
                  <Text style={styles.emptyRevenuesText}>
                    No shift revenue reports yet
                  </Text>
                  <Text style={styles.emptyRevenuesHint}>
                    Staff revenue submissions will appear here once shifts
                    are completed and closed.
                  </Text>
                </View>
              ) : (
                <View style={styles.revenuesList}>
                  {sortedRevenues.map((item) => (
                    <ShiftRevenueCard key={item._id} item={item} />
                  ))}
                </View>
              )}

              {/* Bottom spacer */}
              <View style={{ height: 24 }} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: 32,
    gap: Spacing.lg,
  },
  glow: {
    position: 'absolute',
    top: -140,
    left: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(249,115,22,0.05)',
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  headerSection: {
    gap: Spacing.xs,
  },
  pageTitle: {
    fontSize: FontSize['2xl'],
    fontWeight: '900',
    color: Colors.text,
  },
  pageSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: '500',
    lineHeight: 20,
  },

  // ── Error ──────────────────────────────────────────────────────────────────
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    padding: Spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.error,
    fontWeight: '600',
  },

  // ── Empty state (no building) ──────────────────────────────────────────────
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['3xl'],
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '900',
    color: Colors.text,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.xl,
  },

  // ── Summary Card ───────────────────────────────────────────────────────────
  summaryCard: {
    gap: Spacing.md,
    borderColor: Colors.border,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  summaryTitle: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: '800',
    color: Colors.text,
  },
  summaryReconciledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  summaryReconciledText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  summaryGrid: {
    gap: Spacing.sm,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  summaryValue: {
    fontSize: FontSize.md,
    fontWeight: '900',
    color: Colors.text,
  },
  summaryValueSm: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },

  // ── Section Header ─────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  sectionTitle: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: Colors.text,
  },
  sectionCount: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textMuted,
  },

  // ── Revenue List ───────────────────────────────────────────────────────────
  revenuesList: {
    gap: Spacing.md,
  },

  // ── Empty Revenues ─────────────────────────────────────────────────────────
  emptyRevenuesBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['3xl'],
    gap: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyRevenuesText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textDim,
  },
  emptyRevenuesHint: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.xl,
  },

  // ── Shift Revenue Card ─────────────────────────────────────────────────────
  revenueCard: {
    gap: Spacing.md,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  staffAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardAlt,
  },
  cardHeaderInfo: {
    flex: 1,
    gap: 2,
  },
  staffName: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.text,
  },
  workDate: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textMuted,
  },

  // ── Reconciled Badge ───────────────────────────────────────────────────────
  reconciledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  reconciledBadgeTrue: {
    backgroundColor: Colors.successBg,
    borderColor: Colors.successBorder,
  },
  reconciledBadgeFalse: {
    backgroundColor: Colors.warningBg,
    borderColor: Colors.warningBorder,
  },
  reconciledBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Shift Info ─────────────────────────────────────────────────────────────
  shiftInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shiftInfoText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  shiftTimeText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textDim,
  },

  // ── Divider ────────────────────────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },

  // ── Total Revenue ─────────────────────────────────────────────────────────
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  totalAmount: {
    fontSize: FontSize['2xl'],
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: -0.5,
  },

  // ── Sessions ───────────────────────────────────────────────────────────────
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sessionLabel: {
    flex: 1,
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textDim,
  },
  sessionCountBox: {
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  sessionCount: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.text,
  },

  // ── Payment Breakdown ─────────────────────────────────────────────────────
  paymentBreakdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  paymentBadgeLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  paymentBadgeAmount: {
    fontSize: FontSize.xs,
    fontWeight: '800',
  },

  // ── Card Footer ────────────────────────────────────────────────────────────
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardFooterText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textDim,
  },
});