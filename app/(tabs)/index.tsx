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
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { getWallet } from '../../services/wallet';
import { listReservations } from '../../services/reservations';
import { listParkingHistory } from '../../services/history';
import { listPackages } from '../../services/longTerm';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import type { WalletInfo, Reservation, ParkingSession, LongTermPackage } from '../../types';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function AnimatedPressable({
  children,
  onPress,
  style,
  contentStyle,
}: {
  children: React.ReactNode;
  onPress: () => void;
  style?: any;
  contentStyle?: any;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.96, { duration: 100 });
  };
  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 150 });
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={style}>
      <Animated.View style={[{ width: '100%', alignItems: 'center', justifyContent: 'center' }, contentStyle, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

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
    <AnimatedPressable style={styles.quickLink} onPress={onPress}>
      <View style={styles.quickLinkIcon}>
        <Ionicons name={icon} size={24} color={Colors.primary} />
      </View>
      <Text style={styles.quickLinkLabel}>{label}</Text>
    </AnimatedPressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { session, logout } = useAuthStore();

  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [activeReservations, setActiveReservations] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSession, setActiveSession] = useState<ParkingSession | null>(null);
  const [packages, setPackages] = useState<LongTermPackage[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [homeVehicleFilter, setHomeVehicleFilter] = useState<'all' | 'car' | 'motorcycle'>('all');

  // Animations Shared Values
  const heroOpacity = useSharedValue(0);
  const heroTranslateY = useSharedValue(15);
  const statsScale = useSharedValue(0.95);
  const statsOpacity = useSharedValue(0);

  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.8);

  useEffect(() => {
    // Hero balance fade and slide entrance
    heroOpacity.value = withTiming(1, { duration: 600 });
    heroTranslateY.value = withTiming(0, { duration: 600 });

    // Stats card staggered spring scale
    statsScale.value = withDelay(150, withTiming(1, { duration: 500 }));
    statsOpacity.value = withDelay(150, withTiming(1, { duration: 500 }));

    // Loop active check-in pulse dot
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.6, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      false
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.2, { duration: 1000 }),
        withTiming(0.8, { duration: 1000 })
      ),
      -1,
      false
    );
  }, []);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: [{ translateY: heroTranslateY.value }],
  }));

  const statsStyle = useAnimatedStyle(() => ({
    opacity: statsOpacity.value,
    transform: [{ scale: statsScale.value }],
  }));

  const pulseDotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const load = async () => {
    if (!session?.token) return;
    try {
      const [w, rs, h, pkgs] = await Promise.allSettled([
        getWallet(session.token),
        listReservations(session.token),
        listParkingHistory(session.token),
        listPackages(session.token),
      ]);
      if (w.status === 'fulfilled') setWallet(w.value);
      if (rs.status === 'fulfilled') {
        setActiveReservations(
          rs.value.filter((r: Reservation) => r.status === 'confirmed').length,
        );
      }
      if (h.status === 'fulfilled') {
        const active = h.value.find((s: ParkingSession) => s.status === 'active');
        setActiveSession(active ?? null);
      }
      if (pkgs.status === 'fulfilled') {
        setPackages(pkgs.value.filter(p => p.isActive));
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
          <AnimatedPressable style={styles.logoutBtn} onPress={logout}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="log-out-outline" size={16} color={Colors.error} />
              <Text style={styles.logoutText}>Sign out</Text>
            </View>
          </AnimatedPressable>
        </View>

        {/* Hero card */}
        <Animated.View style={[styles.heroCard, heroStyle]}>
          <View style={[styles.heroBg, { pointerEvents: 'none' }]} />
          <Text style={styles.heroLabel}>WALLET BALANCE</Text>
          <Text style={styles.heroValue}>
            {wallet !== null
              ? `${wallet.balance.toLocaleString('en-US')} VND`
              : '—'}
          </Text>
          <Text style={styles.heroSub}>{session?.email}</Text>
        </Animated.View>

        {/* Active Parking Session Card */}
        {activeSession && (
          <View style={styles.activeSessionCard}>
            <View style={styles.activeCardHeader}>
              <View style={styles.activePulseRow}>
                <View style={{ width: 14, height: 14, justifyContent: 'center', alignItems: 'center', marginRight: 4 }}>
                  <Animated.View style={[{
                    position: 'absolute',
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: Colors.success,
                  }, pulseDotStyle]} />
                  <View style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: Colors.success,
                  }} />
                </View>
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
        <Animated.View style={[styles.statsRow, statsStyle]}>
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
        </Animated.View>

        {/* Quick QR Check-in Entry */}
        {session?.role?.toLowerCase() === 'user' && session?.userId ? (
          <AnimatedPressable 
            style={styles.qrShortcutCard} 
            onPress={() => setShowQR(true)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
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
            </View>
          </AnimatedPressable>
        ) : null}

        {/* Package Pricing Carousel */}
        {packages.length > 0 && (
          <View style={styles.section}>
            <View style={styles.packageHeaderRow}>
              <Text style={styles.sectionTitle}>Subscription Packages</Text>
              <View style={styles.filterContainer}>
                {(['all', 'car', 'motorcycle'] as const).map((filter) => (
                  <TouchableOpacity
                    key={filter}
                    style={[
                      styles.filterTab,
                      homeVehicleFilter === filter && styles.filterTabActive
                    ]}
                    onPress={() => setHomeVehicleFilter(filter)}
                  >
                    <Text style={[
                      styles.filterTabText,
                      homeVehicleFilter === filter && styles.filterTabTextActive
                    ]}>
                      {filter === 'all' ? 'All' : filter === 'car' ? 'Car' : 'Motorcycle'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {(() => {
              const filteredPackages = packages.filter((pkg) => {
                if (homeVehicleFilter === 'all') return true;
                const pkgType = typeof pkg.vehicleType === 'object' && pkg.vehicleType ? pkg.vehicleType.code : pkg.vehicleType;
                return String(pkgType).toLowerCase() === homeVehicleFilter;
              });

              if (filteredPackages.length === 0) {
                return (
                  <View style={styles.emptyPackagesCard}>
                    <Ionicons name="pricetags-outline" size={24} color={Colors.textDim} />
                    <Text style={styles.emptyPackagesText}>No packages available for this vehicle type.</Text>
                  </View>
                );
              }

              return (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.carouselContainer}
                >
                  {filteredPackages.map((pkg) => {
                    const pkgTypeCode = typeof pkg.vehicleType === 'object' && pkg.vehicleType ? pkg.vehicleType.code : pkg.vehicleType;
                    const isCar = String(pkgTypeCode).toLowerCase() === 'car';
                    const tagLabel = pkg.durationDays <= 7 ? 'Weekly' : pkg.durationDays <= 30 ? 'Monthly' : 'Yearly';
                    const buildingName = typeof pkg.building === 'object' && pkg.building ? pkg.building.name : 'All Buildings';
                    const buildingId = typeof pkg.building === 'object' && pkg.building ? pkg.building._id : '';
                    const vehicleType = typeof pkg.vehicleType === 'object' && pkg.vehicleType ? pkg.vehicleType.code : 'car';

                    const isWeekly = pkg.durationDays <= 7;
                    const isMonthly = pkg.durationDays <= 30 && pkg.durationDays > 7;
                    const themeColor = isWeekly ? Colors.primary : isMonthly ? Colors.blue : Colors.purple;
                    const themeBg = isWeekly ? 'rgba(249,115,22,0.12)' : isMonthly ? 'rgba(59,130,246,0.12)' : 'rgba(168,85,247,0.12)';
                    const borderThemeColor = isWeekly ? 'rgba(249,115,22,0.18)' : isMonthly ? 'rgba(59,130,246,0.18)' : 'rgba(168,85,247,0.22)';
                    const glowOrbColor = isWeekly ? 'rgba(249,115,22,0.06)' : isMonthly ? 'rgba(59,130,246,0.06)' : 'rgba(168,85,247,0.06)';

                    return (
                      <AnimatedPressable
                        key={pkg._id}
                        style={[styles.packageCard, { borderColor: borderThemeColor, shadowColor: themeColor }]}
                        contentStyle={{ alignItems: 'stretch' }}
                        onPress={() => {
                          router.push({
                            pathname: '/(tabs)/reservations',
                            params: { buildingId, packageId: pkg._id, vehicleType },
                          });
                        }}
                      >
                        <View style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg - 1, overflow: 'hidden', pointerEvents: 'none' }]}>
                          <View style={[styles.packageCardGlowOrb, { backgroundColor: glowOrbColor }]} />
                        </View>
                        <View style={styles.packageCardHeader}>
                          <Text style={[styles.packageTag, { backgroundColor: themeBg, color: themeColor }]}>
                            {tagLabel}
                          </Text>
                          <View style={[
                            styles.packageVehicleBadge,
                            { 
                              borderColor: isCar ? 'rgba(59,130,246,0.12)' : 'rgba(16,185,129,0.12)',
                              backgroundColor: isCar ? 'rgba(59,130,246,0.03)' : 'rgba(16,185,129,0.03)'
                            }
                          ]}>
                            <Ionicons name={isCar ? "car" : "bicycle"} size={10} color={isCar ? Colors.blue : Colors.success} />
                            <Text style={[styles.packageVehicleText, { color: isCar ? Colors.blue : Colors.success }]}>
                              {isCar ? 'Car' : 'Motorcycle'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.packageName} numberOfLines={1}>{pkg.name}</Text>
                        <View style={styles.packageBuildingRow}>
                          <Ionicons name="business-outline" size={12} color={Colors.textDim} />
                          <Text style={styles.packageBuilding} numberOfLines={1}>
                            {buildingName}
                          </Text>
                        </View>
                        <View style={styles.packageMetaRow}>
                          <View style={styles.packageMetaItem}>
                            <Ionicons name="time-outline" size={12} color={Colors.textDim} />
                            <Text style={styles.packageMetaText}>{pkg.durationDays} Days</Text>
                          </View>
                        </View>
                        <View style={styles.packagePriceRow}>
                          <View>
                            <Text style={styles.packagePriceLabel}>PRICE</Text>
                            <Text style={styles.packagePrice}>{(pkg.price).toLocaleString('en-US')} VND</Text>
                          </View>
                          <View style={[styles.packageActionBtnContainer, { backgroundColor: themeColor }]}>
                            <Text style={styles.packageActionBtnText}>Subscribe</Text>
                            <Ionicons name="arrow-forward" size={10} color="#ffffff" />
                          </View>
                        </View>
                      </AnimatedPressable>
                    );
                  })}
                </ScrollView>
              );
            })()}
          </View>
        )}

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
    borderRadius: Radius['xl'],
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
  packageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: Radius.full,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  filterTabTextActive: {
    color: Colors.text,
    fontWeight: '700',
  },
  emptyPackagesCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  emptyPackagesText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  carouselContainer: {
    gap: Spacing.md,
    paddingRight: Spacing.lg,
    paddingVertical: 4,
  },
  packageCard: {
    width: 275,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(249,115,22,0.15)',
    padding: Spacing.lg,
    gap: Spacing.md,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  packageCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  packageTag: {
    backgroundColor: 'rgba(249,115,22,0.12)',
    color: Colors.primary,
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  packageVehicleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  packageVehicleText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  packageName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  packageBuildingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -2,
  },
  packageBuilding: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    flex: 1,
  },
  packageMetaRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: 2,
  },
  packageMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  packageMetaText: {
    fontSize: 12,
    color: Colors.textDim,
  },
  packagePriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: Spacing.md,
    marginTop: 4,
  },
  packagePriceLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: Colors.textDim,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  packagePrice: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  packageActionBtnContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  packageActionBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  packageCardGlowOrb: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
  },
});
