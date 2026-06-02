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
  getBuildingWallet,
  getBuildingDailyRevenue,
  getBuildingTransactions,
  type ManagerBuilding,
  type BuildingWallet,
  type DailyRevenue,
  type WalletTransaction,
} from '../../../services/manager';
import { Card } from '../../../components/ui/Card';
import { Colors, FontSize, Radius, Spacing } from '../../../constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatVND(amount: number | null | undefined): string {
  const safe = amount ?? 0;
  return `${safe.toLocaleString('en-US')}₫`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${mins}`;
}

function formatReason(reason: string | null | undefined): string {
  if (!reason) return 'Unknown';
  return reason
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function reasonIcon(reason: string): IoniconName {
  if (reason === 'parking_fee') return 'car-outline';
  if (reason === 'reservation_fee') return 'calendar-outline';
  if (reason === 'transfer_to_system') return 'arrow-up-circle-outline';
  if (reason === 'refund') return 'refresh-outline';
  return 'receipt-outline';
}

// ─── Stat Badge ──────────────────────────────────────────────────────────────

interface StatBadgeProps {
  label: string;
  value: string;
  icon: IoniconName;
  color: string;
}

function StatBadge({ label, value, icon, color }: StatBadgeProps) {
  return (
    <View style={styles.statBadge}>
      <Ionicons name={icon} size={16} color={color} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.statBadgeLabel}>{label}</Text>
        <Text style={[styles.statBadgeValue, { color }]}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Transaction Row ─────────────────────────────────────────────────────────

interface TransactionRowProps {
  transaction: WalletTransaction;
}

function TransactionRow({ transaction }: TransactionRowProps) {
  const isCredit = transaction.type === 'credit';
  const color = isCredit ? Colors.success : Colors.text;
  const sign = isCredit ? '+' : '-';

  return (
    <View style={styles.txRow}>
      <View style={[styles.txIconWrap, { backgroundColor: `${color}14` }]}>
        <Ionicons
          name={reasonIcon(transaction.reason)}
          size={20}
          color={color}
        />
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txReason}>
          {formatReason(transaction.reason)}
        </Text>
        <Text style={styles.txDate}>
          {formatDate(transaction.createdAt)}
        </Text>
      </View>
      <View style={styles.txAmountWrap}>
        <Text style={[styles.txAmount, { color }]}>
          {sign}{formatVND(transaction.amount)}
        </Text>
        {transaction.note && (
          <Text style={styles.txNote} numberOfLines={1}>
            {transaction.note}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function WalletScreen() {
  const router = useRouter();
  const { session } = useAuthStore();
  const token = session?.token ?? '';

  // State
  const [building, setBuilding] = useState<ManagerBuilding | null>(null);
  const [wallet, setWallet] = useState<BuildingWallet | null>(null);
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch Wallet Data ──────────────────────────────────────────────────────

  const fetchWalletData = useCallback(async () => {
    if (!token) return;
    setError(null);

    try {
      // 1. Get the building first (we need buildingId for subsequent calls)
      const buildingsRes = await getManagerBuildings(token);
      const buildings = Array.isArray(buildingsRes?.data) ? buildingsRes.data : [];

      if (buildings.length === 0) {
        setBuilding(null);
        setWallet(null);
        setDailyRevenue(null);
        setTransactions([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const bld = buildings[0];
      setBuilding(bld);

      // 2. Concurrent wallet, daily revenue & transactions fetches
      const [walletRes, revenueRes, txRes] = await Promise.all([
        getBuildingWallet(bld._id, token),
        getBuildingDailyRevenue(bld._id, token),
        getBuildingTransactions(bld._id, token),
      ]);

      if (walletRes?.data?.wallet) {
        setWallet(walletRes.data.wallet);
      }

      if (revenueRes?.data) {
        setDailyRevenue(revenueRes.data);
      }

      if (txRes?.data?.items) {
        setTransactions(txRes.data.items);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load wallet data';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchWalletData();
  }, [fetchWalletData]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading && !wallet) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading wallet…</Text>
        </View>
      </SafeAreaView>
    );
  }

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

          {/* ── Error Banner ────────────────────────────────────────────── */}
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

          {/* ── Balance Card ────────────────────────────────────────────── */}
          {wallet && (
            <Card style={styles.balanceCard} padding={Spacing['2xl']}>
              {/* Building name header inside card */}
              {building && (
                <View style={styles.balanceHeaderRow}>
                  <Ionicons
                    name="wallet-outline"
                    size={20}
                    color={Colors.primary}
                  />
                  <Text style={styles.balanceBuildingName}>
                    {building.name}
                  </Text>
                </View>
              )}

              <Text style={styles.balanceLabel}>Wallet Balance</Text>
              <Text style={styles.balanceValue}>
                {formatVND(wallet.balance)}
              </Text>

              <View style={styles.balanceStatsRow}>
                <StatBadge
                  label="Total Received"
                  value={formatVND(wallet.totalReceived)}
                  icon="arrow-down-circle-outline"
                  color={Colors.success}
                />
                <StatBadge
                  label="Total Transferred"
                  value={formatVND(wallet.totalTransferred)}
                  icon="arrow-up-circle-outline"
                  color={Colors.warning}
                />
              </View>
            </Card>
          )}

          {/* ── Daily Revenue Section ───────────────────────────────────── */}
          {dailyRevenue && (
            <Card style={styles.revenueCard} padding={Spacing.xl}>
              <View style={styles.revenueHeader}>
                <Ionicons
                  name="trending-up-outline"
                  size={20}
                  color={Colors.blue}
                />
                <Text style={styles.sectionTitle}>Today's Revenue</Text>
                <Text style={styles.revenueDate}>{dailyRevenue.date}</Text>
              </View>

              <View style={styles.revenueRow}>
                <View style={[styles.revenueItem, { flex: 2 }]}>
                  <Text style={styles.revenueItemLabel}>Total</Text>
                  <Text style={[styles.revenueItemValue, { color: Colors.text }]}>
                    {formatVND(dailyRevenue.totalRevenue)}
                  </Text>
                </View>
                <View style={styles.revenueDivider} />
                <View style={styles.revenueItem}>
                  <Text style={styles.revenueItemLabel}>Parking</Text>
                  <Text style={[styles.revenueItemValue, { color: Colors.success }]}>
                    {formatVND(dailyRevenue.parkingFees)}
                  </Text>
                </View>
                <View style={styles.revenueDivider} />
                <View style={styles.revenueItem}>
                  <Text style={styles.revenueItemLabel}>Reservation</Text>
                  <Text style={[styles.revenueItemValue, { color: Colors.amber }]}>
                    {formatVND(dailyRevenue.reservationFees)}
                  </Text>
                </View>
              </View>

              {dailyRevenue.sessionCount !== undefined && (
                <View style={styles.sessionRow}>
                  <Ionicons
                    name="swap-horizontal-outline"
                    size={14}
                    color={Colors.textMuted}
                  />
                  <Text style={styles.sessionText}>
                    {dailyRevenue.sessionCount} sessions today
                  </Text>
                </View>
              )}
            </Card>
          )}

          {/* ── Transactions List ───────────────────────────────────────── */}
          <View style={styles.txSection}>
            <View style={styles.txHeader}>
              <Text style={styles.sectionTitle}>Recent Transactions</Text>
              <Text style={styles.txCount}>
                {transactions.length > 0
                  ? `${transactions.length} items`
                  : ''}
              </Text>
            </View>

            {transactions.length === 0 && !loading ? (
              <View style={styles.emptyTxBox}>
                <Ionicons
                  name="receipt-outline"
                  size={36}
                  color={Colors.textDim}
                />
                <Text style={styles.emptyTxText}>
                  No transactions yet
                </Text>
              </View>
            ) : (
              transactions.map((tx) => (
                <TransactionRow key={tx._id} transaction={tx} />
              ))
            )}
          </View>

          {/* Bottom spacer */}
          <View style={{ height: 16 }} />
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
    paddingTop: Spacing.lg,
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

  // ── Empty state ────────────────────────────────────────────────────────────
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

  // ── Balance Card ───────────────────────────────────────────────────────────
  balanceCard: {
    gap: Spacing.md,
    alignItems: 'center',
    borderColor: 'rgba(249,115,22,0.2)',
  },
  balanceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  balanceBuildingName: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  balanceLabel: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  balanceValue: {
    fontSize: FontSize['3xl'],
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: 1,
  },
  balanceStatsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    width: '100%',
  },
  statBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  statBadgeLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statBadgeValue: {
    fontSize: FontSize.sm,
    fontWeight: '900',
  },

  // ── Daily Revenue ──────────────────────────────────────────────────────────
  revenueCard: {
    gap: Spacing.md,
    borderColor: 'rgba(59,130,246,0.2)',
  },
  revenueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionTitle: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: Colors.text,
  },
  revenueDate: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  revenueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  revenueItem: {
    alignItems: 'center',
    gap: 2,
  },
  revenueItemLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  revenueItemValue: {
    fontSize: FontSize.base,
    fontWeight: '900',
  },
  revenueDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: Colors.border,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  sessionText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textMuted,
  },

  // ── Transactions ───────────────────────────────────────────────────────────
  txSection: {
    gap: Spacing.sm,
  },
  txHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  txCount: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  txIconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: {
    flex: 1,
    gap: 2,
  },
  txReason: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.text,
  },
  txDate: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textDim,
  },
  txAmountWrap: {
    alignItems: 'flex-end',
    gap: 2,
  },
  txAmount: {
    fontSize: FontSize.base,
    fontWeight: '900',
  },
  txNote: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textMuted,
    maxWidth: 120,
  },
  emptyTxBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['2xl'],
    gap: Spacing.sm,
  },
  emptyTxText: {
    fontSize: FontSize.sm,
    color: Colors.textDim,
    fontWeight: '600',
  },
});