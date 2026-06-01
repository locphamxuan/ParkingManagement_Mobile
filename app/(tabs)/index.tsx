import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Modal,
  Image,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { getWallet } from '../../services/wallet';
import { listReservations } from '../../services/reservations';
import { listParkingHistory } from '../../services/history';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import type { WalletInfo, Reservation, ParkingSession } from '../../types';

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
  const [activeSession, setActiveSession] = useState<ParkingSession | null>(null);
  const [showQR, setShowQR] = useState(false);

  const load = async () => {
    if (!session?.token) return;
    try {
      const [w, rs, h] = await Promise.allSettled([
        getWallet(session.token),
        listReservations(session.token),
        listParkingHistory(session.token),
      ]);
      if (w.status === 'fulfilled') setWallet(w.value);
      if (rs.status === 'fulfilled') {
        setActiveReservations(
          rs.value.filter((r: Reservation) => r.status === 'active').length,
        );
      }
      if (h.status === 'fulfilled') {
        const active = h.value.find((s: ParkingSession) => s.status === 'active');
        setActiveSession(active ?? null);
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

        {/* Active Parking Session Card */}
        {activeSession && (
          <View style={styles.activeSessionCard}>
            <View style={styles.activeCardHeader}>
              <View style={styles.activePulseRow}>
                <View style={styles.pulseDot} />
                <Text style={styles.activeSessionTitle}>ACTIVE PARKING</Text>
              </View>
              <Text style={styles.activeBuildingText}>
                {activeSession.building?.name ?? 'PBMS Parking'}
              </Text>
            </View>
            <View style={styles.activeDetails}>
              <View style={styles.detailRow}>
                <Ionicons name="car-outline" size={16} color={Colors.primary} />
                <Text style={styles.detailText}>
                  Vehicle Plate: <Text style={styles.detailBold}>{activeSession.plateNumber}</Text>
                </Text>
              </View>
              {activeSession.slot && (
                <View style={styles.detailRow}>
                  <Ionicons name="grid-outline" size={16} color={Colors.blue} />
                  <Text style={styles.detailText}>
                    Slot: <Text style={styles.detailBold}>{activeSession.slot.code}</Text>
                  </Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={16} color={Colors.success} />
                <Text style={styles.detailText}>
                  Checked-in at: <Text style={styles.detailBold}>{new Date(activeSession.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</Text>
                </Text>
              </View>
            </View>
          </View>
        )}

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

        {/* Quick QR Check-in Entry */}
        {session?.role?.toLowerCase() === 'user' && session?.userId ? (
          <TouchableOpacity 
            style={styles.qrShortcutCard} 
            activeOpacity={0.8}
            onPress={() => setShowQR(true)}
          >
            <View style={styles.qrShortcutLeft}>
              <View style={styles.qrShortcutIconContainer}>
                <Ionicons name="qr-code-outline" size={24} color={Colors.primary} />
              </View>
              <View style={{ gap: 2 }}>
                <Text style={styles.qrShortcutTitle}>My QR Check-in</Text>
                <Text style={styles.qrShortcutSubtitle}>Tap to show check-in code at the gate</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward-outline" size={20} color={Colors.textDim} />
          </TouchableOpacity>
        ) : null}

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

        {/* QR Code Bottom Sheet Modal */}
        <Modal
          visible={showQR}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowQR(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>QR CHECK-IN</Text>
                <TouchableOpacity onPress={() => setShowQR(false)} style={styles.closeBtn}>
                  <Ionicons name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSubtitle}>
                Scan this code at the parking gate scanner to check-in or checkout.
              </Text>
              <View style={styles.qrContainer}>
                <Image
                  source={{
                    uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=http://192.168.0.103:8081/profile?userId=${session?.userId}`,
                  }}
                  style={styles.qrModalImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.modalInfoTag}>
                <Text style={styles.modalIdText}>MEMBER ID: {session?.userId}</Text>
              </View>
            </View>
          </View>
        </Modal>

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

  // Active Parking Session Styles
  activeSessionCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  activeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.xs,
  },
  activePulseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  activeSessionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.success,
    letterSpacing: 1.5,
  },
  activeBuildingText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  activeDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  detailText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  detailBold: {
    fontWeight: '800',
    color: Colors.text,
  },

  // QR Shortcut Card
  qrShortcutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.2)',
    padding: Spacing.lg,
  },
  qrShortcutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  qrShortcutIconContainer: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(249,115,22,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrShortcutTitle: {
    fontSize: FontSize.sm,
    fontWeight: '900',
    color: Colors.text,
  },
  qrShortcutSubtitle: {
    fontSize: 10,
    color: Colors.textMuted,
  },

  // Modal Overlay and Contents
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)',
    width: '100%',
    maxWidth: 340,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalTitle: {
    fontSize: FontSize.md,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: 1.5,
  },
  closeBtn: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.xs,
  },
  qrContainer: {
    backgroundColor: '#ffffff',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrModalImage: {
    width: 180,
    height: 180,
  },
  modalInfoTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.2)',
  },
  modalIdText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
  },
});
