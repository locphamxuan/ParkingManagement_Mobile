import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../store/authStore';
import {
  getManagerBuildings,
  getBuildingDashboard,
  type ManagerBuilding,
  type DashboardStats,
} from '../../../services/manager';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { Colors, FontSize, Radius, Spacing } from '../../../constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ─── Stat Card ──────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  icon: IoniconName;
  color: string;
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <Card style={styles.statCard} padding={Spacing.lg}>
      <View style={[styles.statIconWrap, { backgroundColor: `${color}14` }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

// ─── Module Link ────────────────────────────────────────────────────────────

interface ModuleLinkProps {
  icon: IoniconName;
  label: string;
  onPress: () => void;
  color?: string;
}

function ModuleLink({ icon, label, onPress, color = Colors.primary }: ModuleLinkProps) {
  return (
    <TouchableOpacity
      style={styles.moduleLink}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.moduleIconWrap, { backgroundColor: `${color}14` }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.moduleLabel}>{label}</Text>
      <Ionicons name="chevron-forward-outline" size={16} color={Colors.textDim} />
    </TouchableOpacity>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function ManagerDashboardScreen() {
  const router = useRouter();
  const { session } = useAuthStore();
  const token = session?.token ?? '';

  // State
  const [building, setBuilding] = useState<ManagerBuilding | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch Dashboard Data ──────────────────────────────────────────────────

  const fetchDashboardData = useCallback(async () => {
    if (!token) return;
    setError(null);

    try {
      const buildingsRes = await getManagerBuildings(token);
      const buildings = Array.isArray(buildingsRes?.data) ? buildingsRes.data : [];

      if (buildings.length === 0) {
        setBuilding(null);
        setStats(null);
        return;
      }

      const bld = buildings[0];
      setBuilding(bld);

      const dashRes = await getBuildingDashboard(bld._id, token);
      if (dashRes?.data) {
        setStats(dashRes.data);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load dashboard data';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData();
  }, [fetchDashboardData]);

  // ── Derived values ────────────────────────────────────────────────────────

  const todayRevenue =
    stats?.todayRevenue !== undefined
      ? `${stats.todayRevenue.toLocaleString('en-US')} VND`
      : '—';

  const occupancyRate =
    stats?.occupancyRate !== undefined
      ? `${stats.occupancyRate}%`
      : stats && stats.totalSlots > 0
      ? `${Math.round((stats.occupiedSlots / stats.totalSlots) * 100)}%`
      : '—';

  const buildingId = building?._id;

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading && !building) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading dashboard…</Text>
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
          <View style={[styles.glow, { pointerEvents: 'none' }]} />

          {/* ── Header ──────────────────────────────────────────────────── */}
          {building && (
            <View style={styles.headerCard}>
              <View style={styles.headerTop}>
                <View style={styles.buildingInfo}>
                  <Text style={styles.buildingName}>{building.name}</Text>
                  <Text style={styles.buildingCode}>{building.code}</Text>
                </View>
                <Badge
                  label={building.status ?? 'active'}
                  variant={
                    building.status === 'active'
                      ? 'success'
                      : building.status === 'maintenance'
                      ? 'warning'
                      : 'error'
                  }
                />
              </View>

              {building.address?.fullAddress && (
                <View style={styles.addressRow}>
                  <Ionicons
                    name="location-outline"
                    size={14}
                    color={Colors.textMuted}
                  />
                  <Text style={styles.addressText}>
                    {building.address.fullAddress}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── Error banner ───────────────────────────────────────────── */}
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

          {/* ── Stats Grid ─────────────────────────────────────────────── */}
          {stats && (
            <View style={styles.statsGrid}>
              <StatCard
                label="Total Slots"
                value={String(stats.totalSlots)}
                icon="grid-outline"
                color={Colors.blue}
              />
              <StatCard
                label="Available"
                value={String(stats.availableSlots)}
                icon="checkmark-circle-outline"
                color={Colors.success}
              />
              <StatCard
                label="Occupied"
                value={String(stats.occupiedSlots)}
                icon="car-outline"
                color={Colors.primary}
              />
              <StatCard
                label="Occupancy"
                value={occupancyRate}
                icon="pulse-outline"
                color={Colors.purple}
              />
            </View>
          )}

          {/* ── Revenue & Active Sessions Row ────────────────────────────── */}
          {stats && (
            <View style={styles.revenueRow}>
              <Card style={styles.revenueCard} padding={Spacing.xl}>
                <View style={styles.revenueIconWrap}>
                  <Ionicons
                    name="wallet-outline"
                    size={24}
                    color={Colors.amber}
                  />
                </View>
                <Text style={styles.revenueLabel}>Today's Revenue</Text>
                <Text style={styles.revenueValue}>{todayRevenue}</Text>
              </Card>

              <Card style={styles.revenueCard} padding={Spacing.xl}>
                <View style={[styles.revenueIconWrap, { backgroundColor: `${Colors.blue}14` }]}>
                  <Ionicons
                    name="people-outline"
                    size={24}
                    color={Colors.blue}
                  />
                </View>
                <Text style={styles.revenueLabel}>Active Sessions</Text>
                <Text style={styles.revenueValue}>{stats.activeStaff}</Text>
              </Card>
            </View>
          )}

          {/* ── Sub-module Quick Links ─────────────────────────────────── */}
          <View style={styles.modulesSection}>
            <Text style={styles.sectionTitle}>Management</Text>
            <View style={styles.modulesList}>
              <ModuleLink
                icon="layers-outline"
                label="Floors & Slots"
                color={Colors.blue}
                onPress={() => {
                  if (buildingId) router.push(`/(tabs)/manager/floors?buildingId=${buildingId}`);
                }}
              />
              <ModuleLink
                icon="wallet-outline"
                label="Wallet & Payments"
                color={Colors.amber}
                onPress={() => {
                  if (buildingId) router.push(`/(tabs)/manager/wallet?buildingId=${buildingId}`);
                }}
              />
              <ModuleLink
                icon="swap-horizontal-outline"
                label="Shift Management"
                color={Colors.purple}
                onPress={() => {
                  if (buildingId) router.push(`/(tabs)/manager/shifts?buildingId=${buildingId}`);
                }}
              />
              <ModuleLink
                icon="bar-chart-outline"
                label="Reports & History"
                color={Colors.primary}
                onPress={() => {
                  if (buildingId) router.push(`/(tabs)/manager/history?buildingId=${buildingId}`);
                }}
              />
              <ModuleLink
                icon="chatbubble-ellipses-outline"
                label="Customer Feedback"
                color={Colors.purple}
                onPress={() => {
                  if (buildingId) router.push(`/(tabs)/manager/feedback?buildingId=${buildingId}`);
                }}
              />
            </View>
          </View>

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

          {/* Bottom spacer */}
          <View style={{ height: 16 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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

  // ── Header ────────────────────────────────────────────────────────────────
  headerCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.2)',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  buildingInfo: {
    flex: 1,
    gap: 4,
    marginRight: Spacing.sm,
  },
  buildingName: {
    fontSize: FontSize.xl,
    fontWeight: '900',
    color: Colors.text,
  },
  buildingCode: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addressText: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    fontWeight: '500',
    flex: 1,
  },

  // ── Error banner ──────────────────────────────────────────────────────────
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

  // ── Stats Grid ────────────────────────────────────────────────────────────
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statCard: {
    width: '47%',
    flexGrow: 1,
    minWidth: '45%',
    gap: Spacing.sm,
  },
  statIconWrap: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: FontSize['2xl'],
    fontWeight: '900',
  },
  statLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Revenue row ───────────────────────────────────────────────────────────
  revenueRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  revenueCard: {
    flex: 1,
    gap: Spacing.xs,
    alignItems: 'center',
  },
  revenueIconWrap: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: `${Colors.amber}14`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revenueLabel: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
  },
  revenueValue: {
    fontSize: FontSize.base,
    fontWeight: '900',
    color: Colors.text,
    textAlign: 'center',
  },

  // ── Sub-modules ───────────────────────────────────────────────────────────
  modulesSection: {
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  modulesList: {
    gap: Spacing.sm,
  },
  moduleLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  moduleIconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleLabel: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.text,
  },

  // ── Empty state ───────────────────────────────────────────────────────────
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
});