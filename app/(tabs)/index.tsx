import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { getWallet } from '../../services/wallet';
import { listReservations } from '../../services/reservations';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import type { WalletInfo, Reservation } from '../../types';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={[styles.statCard, { borderColor: `${color}30` }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickLink({
  icon,
  label,
  onPress,
}: {
  icon: IoniconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickLink} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.quickLinkIcon}>
        <Ionicons name={icon} size={24} color={Colors.primary} />
      </View>
      <Text style={styles.quickLinkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { session, logout } = useAuthStore();

  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [activeReservations, setActiveReservations] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!session?.token) return;
    try {
      const [w, rs] = await Promise.allSettled([
        getWallet(session.token),
        listReservations(session.token),
      ]);
      if (w.status === 'fulfilled') setWallet(w.value);
      if (rs.status === 'fulfilled') {
        setActiveReservations(
          rs.value.filter((r: Reservation) => r.status === 'active').length,
        );
      }
    } catch {
      // silently fail
    }
  };

  useEffect(() => { load(); }, [session?.token]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const plateCount = session?.licensePlates?.length ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good {getTimeGreeting()}!</Text>
            <Text style={styles.name} numberOfLines={1}>
              {session?.displayName || 'User'}
            </Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Ionicons name="log-out-outline" size={16} color={Colors.error} />
            <Text style={styles.logoutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        {/* Hero card */}
        <View style={styles.heroCard}>
          <View style={[styles.heroBg, { pointerEvents: 'none' }]} />
          <Text style={styles.heroLabel}>WALLET BALANCE</Text>
          <Text style={styles.heroValue}>
            {wallet !== null
              ? `${wallet.balance.toLocaleString('en-US')} VND`
              : '—'}
          </Text>
          <Text style={styles.heroSub}>{session?.email}</Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCard
            label="Active Reservations"
            value={String(activeReservations)}
            color={Colors.primary}
          />
          <StatCard
            label="Linked Plates"
            value={`${plateCount}/3`}
            color={Colors.blue}
          />
          <StatCard
            label="Account"
            value="Active"
            color={Colors.success}
          />
        </View>

        {/* Quick actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickGrid}>
            <QuickLink
              icon="calendar-outline"
              label="Reserve"
              onPress={() => router.push('/(tabs)/reservations')}
            />
            <QuickLink
              icon="add-circle-outline"
              label="Top Up"
              onPress={() => router.push('/(tabs)/wallet')}
            />
            <QuickLink
              icon="time-outline"
              label="History"
              onPress={() => router.push('/(tabs)/history')}
            />
            <QuickLink
              icon="person-outline"
              label="Profile"
              onPress={() => router.push('/(tabs)/profile')}
            />
          </View>
        </View>

        {/* Profile incomplete warning */}
        {plateCount === 0 && (
          <View style={styles.warningBox}>
            <Ionicons name="alert-circle" size={20} color={Colors.warning} />
            <View style={styles.warningContent}>
              <Text style={styles.warningTitle}>Incomplete Profile</Text>
              <Text style={styles.warningText}>
                Add a license plate so PBMS can identify your vehicle automatically.
              </Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
                <Text style={styles.warningLink}>Go to Profile →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function getTimeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: 32,
    gap: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greeting: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  name: {
    fontSize: FontSize.xl,
    fontWeight: '900',
    color: Colors.text,
    maxWidth: 220,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.errorBg,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
  },
  logoutText: {
    color: Colors.error,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Hero card
  heroCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.2)',
    padding: Spacing['2xl'],
    overflow: 'hidden',
    gap: Spacing.xs,
  },
  heroBg: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(249,115,22,0.07)',
  },
  heroLabel: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.textDim,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  heroValue: {
    fontSize: FontSize['2xl'],
    fontWeight: '900',
    color: Colors.text,
  },
  heroSub: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: FontSize.md,
    fontWeight: '900',
  },
  statLabel: {
    fontSize: 9,
    color: Colors.textDim,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },

  // Section
  section: { gap: Spacing.md },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  quickLink: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  quickLinkIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(249,115,22,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLinkLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textMuted,
  },

  // Warning
  warningBox: {
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
    padding: Spacing.lg,
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  warningContent: { flex: 1, gap: 4 },
  warningTitle: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: Colors.warning,
  },
  warningText: {
    fontSize: FontSize.xs,
    color: 'rgba(245,158,11,0.8)',
    fontWeight: '500',
    lineHeight: 18,
  },
  warningLink: {
    fontSize: FontSize.xs,
    color: Colors.warning,
    fontWeight: '700',
    marginTop: 4,
  },
});
