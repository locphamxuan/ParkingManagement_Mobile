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
import { 
  listNotifications, 
  markNotificationRead
} from '../../services/notifications';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import { styles } from '../../styles/screens/index';
import NotificationBellStream from '../../components/shared/NotificationBellStream';
import type { WalletInfo, Reservation, ParkingSession, LongTermPackage, Notification } from '../../types';
import { useUIStore } from '../../store/uiStore';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function AnimatedPressable({
  children,
  onPress,
  style,
  contentStyle,
  fullWidth = true,
}: {
  children: React.ReactNode;
  onPress: () => void;
  style?: any;
  contentStyle?: any;
  fullWidth?: boolean;
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
      <Animated.View style={[
        { alignItems: 'center', justifyContent: 'center' },
        fullWidth && { width: '100%' },
        contentStyle,
        animatedStyle
      ]}>
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [bellAlertActive, setBellAlertActive] = useState(false);

  const setTabBarHidden = useUIStore((state) => state.setTabBarHidden);

  useEffect(() => {
    setTabBarHidden(showQR || showNotifications);
    return () => setTabBarHidden(false);
  }, [showQR, showNotifications, setTabBarHidden]);

  // Animations Shared Values
  const heroOpacity = useSharedValue(0);
  const heroTranslateY = useSharedValue(15);
  const statsScale = useSharedValue(0.95);
  const statsOpacity = useSharedValue(0);

  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.8);

  const bellRotation = useSharedValue(0);
  const bellScale = useSharedValue(1);

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

  useEffect(() => {
    if (bellAlertActive) {
      // Shaking/ringing animation loop
      bellRotation.value = withRepeat(
        withSequence(
          withTiming(-12, { duration: 80 }),
          withTiming(12, { duration: 160 }),
          withTiming(-10, { duration: 160 }),
          withTiming(10, { duration: 160 }),
          withTiming(-6, { duration: 160 }),
          withTiming(6, { duration: 160 }),
          withTiming(0, { duration: 160 }),
          withDelay(1200, withTiming(0, { duration: 100 }))
        ),
        -1,
        false
      );

      // Pulse scaling loop
      bellScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 400 }),
          withTiming(1, { duration: 400 }),
          withDelay(1200, withTiming(1, { duration: 100 }))
        ),
        -1,
        false
      );
    } else {
      bellRotation.value = withTiming(0, { duration: 200 });
      bellScale.value = withTiming(1, { duration: 200 });
    }
  }, [bellAlertActive]);

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

  const bellAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${bellRotation.value}deg` },
      { scale: bellScale.value }
    ],
  }));

  const load = async () => {
    if (!session?.token) return;
    try {
      const [w, rs, h, pkgs, notifs] = await Promise.allSettled([
        getWallet(session.token),
        listReservations(session.token),
        listParkingHistory(session.token),
        listPackages(session.token),
        listNotifications(session.token),
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
      if (notifs.status === 'fulfilled') {
        setNotifications(notifs.value.items);
        const unread = notifs.value.unread;
        setUnreadCount(unread);
        if (unread > 0) {
          setBellAlertActive(true);
        }
      }
    } catch {
      // silently fail
    }
  };

  const handleMarkAsRead = async (notifId: string) => {
    if (!session?.token) return;
    try {
      await markNotificationRead(session.token, notifId);
      setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, isRead: true } : n));
      setUnreadCount(prev => {
        const next = Math.max(0, prev - 1);
        if (next === 0) {
          setBellAlertActive(false);
        }
        return next;
      });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleNotificationTap = async (notif: Notification) => {
    if (!notif.isRead) {
      await handleMarkAsRead(notif._id);
    }
    setShowNotifications(false);
    router.push('/(tabs)/reservations');
  };

  const handleBellPress = () => {
    setShowNotifications(true);
    setBellAlertActive(false);
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
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.greeting}>Good {getTimeGreeting()}!</Text>
            <Text style={styles.name} numberOfLines={1}>
              {session?.displayName || 'User'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.bellBtn} 
              onPress={handleBellPress}
            >
              <Animated.View style={bellAnimatedStyle}>
                <Ionicons name="notifications-outline" size={22} color={Colors.text} />
              </Animated.View>
              {unreadCount > 0 && (
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <NotificationBellStream token={session?.token ?? ""} />
            <AnimatedPressable style={styles.logoutBtn} onPress={logout} fullWidth={false}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name="log-out-outline" size={16} color={Colors.error} />
                <Text style={styles.logoutText}>Sign out</Text>
              </View>
            </AnimatedPressable>
          </View>
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
              icon="business-outline"
              label="Buildings"
              onPress={() => router.push('/buildings')}
            />
            <QuickLink
              icon="wallet-outline"
              label="Top Up"
              onPress={() => router.push('/(tabs)/wallet')}
            />
            <QuickLink
              icon="time-outline"
              label="History"
              onPress={() => router.push('/(tabs)/history')}
            />
            <QuickLink
              icon="cube-outline"
              label="Packages"
              onPress={() => router.push('/(tabs)/packages')}
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
                    uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${session?.userId}`,
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

        {/* Notifications Modal */}
        <Modal
          visible={showNotifications}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowNotifications(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, styles.notifModalContent]}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="notifications" size={20} color={Colors.primary} />
                  <Text style={styles.modalTitle}>NOTIFICATIONS</Text>
                </View>
                <TouchableOpacity onPress={() => setShowNotifications(false)} style={styles.closeBtn}>
                  <Ionicons name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>



              <ScrollView 
                style={styles.notifList}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, paddingBottom: 10 }}
              >
                {notifications.length === 0 ? (
                  <View style={styles.emptyNotifContainer}>
                    <Ionicons name="notifications-off-outline" size={48} color={Colors.textMuted} />
                    <Text style={styles.emptyNotifText}>No notifications yet</Text>
                  </View>
                ) : (
                  notifications.map((notif) => {
                    const iconInfo = (() => {
                      switch (notif.type) {
                        case 'checkin_rejected':
                        case 'checkout_rejected':
                          return { name: 'close-circle-outline' as IoniconName, color: Colors.error };
                        case 'subscription_expired':
                        case 'subscription_slot_released':
                        case 'reservation_expired':
                          return { name: 'alert-circle-outline' as IoniconName, color: Colors.error };
                        case 'subscription_expiring':
                        case 'reservation_overstay':
                        case 'subscription_overage':
                          return { name: 'warning-outline' as IoniconName, color: Colors.warning };
                        case 'feedback_reply':
                          return { name: 'chatbubble-ellipses-outline' as IoniconName, color: Colors.blue };
                        default:
                          return { name: 'notifications-outline' as IoniconName, color: Colors.primary };
                      }
                    })();
                    return (
                      <TouchableOpacity
                        key={notif._id}
                        style={[
                          styles.notifItem,
                          !notif.isRead && styles.notifItemUnread,
                        ]}
                        onPress={() => handleNotificationTap(notif)}
                      >
                        <View style={styles.notifIconContainer}>
                          <Ionicons name={iconInfo.name} size={20} color={iconInfo.color} />
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={[styles.notifTitle, !notif.isRead && styles.notifTitleUnread]} numberOfLines={1}>
                              {notif.title}
                            </Text>
                            {!notif.isRead && <View style={styles.unreadDot} />}
                          </View>
                          <Text style={styles.notifMessage} numberOfLines={3}>
                            {notif.message}
                          </Text>
                          <Text style={styles.notifTime}>
                            {new Date(notif.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
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
