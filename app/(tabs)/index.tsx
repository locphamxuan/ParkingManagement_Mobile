import React from 'react';
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
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import { styles } from '../../styles/screens/index';
import NotificationBellStream from '../../components/shared/NotificationBellStream';
import type { WalletInfo, Reservation, ParkingSession, LongTermPackage, Notification } from '../../types';
import { useHomeScreen } from '../../hooks/useHomeScreen';
import { HomeNotificationsModal } from '../../components/home/HomeNotificationsModal';
import { AnimatedPressable } from '../../components/ui/AnimatedCard';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];


function QuickLink({
  icon,
  label,
  onPress,
  color = Colors.primary,
  bgColor = 'rgba(14,165,233,0.1)',
}: {
  icon: IoniconName;
  label: string;
  onPress: () => void;
  color?: string;
  bgColor?: string;
}) {
  return (
    <AnimatedPressable style={styles.quickLink} onPress={onPress}>
      <View style={[styles.quickLinkIcon, { backgroundColor: bgColor }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.quickLinkLabel}>{label}</Text>
    </AnimatedPressable>
  );
}

export default function HomeScreen() {
  const {
    router, session, logout, wallet, activeReservations, refreshing, activeSession, packages,
    showQR, setShowQR, notifications, unreadCount, showNotifications, setShowNotifications,
    bellAlertActive, heroStyle, pulseDotStyle, bellAnimatedStyle,
    handleMarkAsRead, handleMarkAllAsRead, handleNotificationTap, handleBellPress, onRefresh, plateCount,
  } = useHomeScreen();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.primaryDark }} edges={['top']}>
      <View style={{ flex: 1, backgroundColor: Colors.bg }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#ffffff"
            />
          }
        >
          {/* Top Curved Block */}
          <View style={{
            backgroundColor: Colors.primaryDark, // Sky-700 deep royal cyan-blue
            borderBottomLeftRadius: 40,
            borderBottomRightRadius: 40,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 32,
            gap: 20,
            shadowColor: Colors.primaryDark,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 8,
          }}>
            {/* Header row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.75)', fontWeight: '600' }}>Good {getTimeGreeting()}!</Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#ffffff', maxWidth: 220 }} numberOfLines={1}>
                  {session?.displayName || 'User'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.25)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}
                  onPress={handleBellPress}
                >
                  <Animated.View style={bellAnimatedStyle}>
                    <Ionicons name="notifications-outline" size={22} color="#ffffff" />
                  </Animated.View>
                  {unreadCount > 0 && (
                    <View style={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      minWidth: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: Colors.error,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 3,
                    }}>
                      <Text style={{ color: '#ffffff', fontSize: 9, fontWeight: '800' }}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <NotificationBellStream token={session?.token ?? ""} />
                
                <AnimatedPressable
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    borderWidth: 1,
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                  }}
                  onPress={logout}
                  fullWidth={false}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Ionicons name="log-out-outline" size={16} color="#fca5a5" />
                    <Text style={{ color: '#fca5a5', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>Sign out</Text>
                  </View>
                </AnimatedPressable>
              </View>
            </View>

            {/* Glassmorphic Wallet Card */}
            <Animated.View style={[{
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.25)',
              padding: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 4,
            }, heroStyle]}>
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: 'rgba(255, 255, 255, 0.7)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 }}>WALLET BALANCE</Text>
                <Text style={{ fontSize: 24, fontWeight: '900', color: '#ffffff', letterSpacing: 0.5 }}>
                  {wallet !== null
                    ? `${wallet.balance.toLocaleString('en-US')} VND`
                    : '—'}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.15)', paddingTop: 12 }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ fontSize: 8, fontWeight: '700', color: 'rgba(255, 255, 255, 0.6)', letterSpacing: 1, marginBottom: 2 }}>CARDHOLDER</Text>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#ffffff', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }} numberOfLines={1}>
                    {session?.displayName ? session.displayName.toUpperCase() : (session?.email ? session.email.split('@')[0].toUpperCase() : 'PBMS MEMBER')}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 12, fontWeight: '900', color: '#ffffff', letterSpacing: 1 }}>PBMS</Text>
                  <Text style={{ fontSize: 6, fontWeight: '700', color: 'rgba(255, 255, 255, 0.6)', letterSpacing: 1 }}>PAYMENT</Text>
                </View>
              </View>

              {activeReservations > 0 && (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  marginTop: 12,
                }}>
                  <Ionicons name="calendar" size={12} color="#ffffff" />
                  <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '700' }}>
                    {activeReservations} active package{activeReservations !== 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </Animated.View>
          </View>

          {/* Bottom Content Area */}
          <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 24 }}>
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

            {/* Quick Actions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.quickRow}>
                <QuickLink
                  icon="alert-circle-outline"
                  label="Incidents"
                  onPress={() => router.push('/incidents')}
                  color="#ef4444"
                  bgColor="rgba(239,68,68,0.12)"
                />
                <QuickLink
                  icon="business-outline"
                  label="Buildings"
                  onPress={() => router.push('/buildings')}
                  color="#10b981" // Emerald Green
                  bgColor="rgba(16,185,129,0.12)"
                />
                <QuickLink
                  icon="wallet-outline"
                  label="Top Up"
                  onPress={() => router.push('/(tabs)/wallet')}
                  color="#3b82f6" // Royal Blue
                  bgColor="rgba(59,130,246,0.12)"
                />
                <QuickLink
                  icon="cube-outline"
                  label="Packages"
                  onPress={() => router.push('/(tabs)/packages')}
                  color="#8b5cf6" // Purple/Violet
                  bgColor="rgba(139,92,246,0.12)"
                />
              </View>
            </View>

            {/* Subscription Packages */}
            {packages.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Subscription Packages</Text>

                {/* Vertical list — first 4 packages, sorted by price ascending, styled with detailed cards */}
                {packages
                  .slice()
                  .sort((a, b) => a.price - b.price)
                  .slice(0, 4)
                  .map((pkg) => {
                    const pkgTypeCode = typeof pkg.vehicleType === 'object' && pkg.vehicleType
                      ? pkg.vehicleType.code : pkg.vehicleType;
                    const isCar = String(pkgTypeCode).toLowerCase() === 'car';
                    const tagLabel = pkg.durationDays <= 7 ? 'Weekly'
                      : pkg.durationDays <= 30 ? 'Monthly' : 'Yearly';
                    const buildingName = typeof pkg.building === 'object' && pkg.building
                      ? pkg.building.name : 'All Buildings';
                    const buildingId = typeof pkg.building === 'object' && pkg.building ? pkg.building._id : '';
                    const vehicleType = typeof pkg.vehicleType === 'object' && pkg.vehicleType ? pkg.vehicleType.code : 'car';

                    const isWeekly = pkg.durationDays <= 7;
                    const isMonthly = pkg.durationDays <= 30 && pkg.durationDays > 7;
                    const themeColor = isWeekly ? Colors.primary : isMonthly ? Colors.blue : Colors.purple;
                    const themeBg = isWeekly ? 'rgba(14,165,233,0.12)' : isMonthly ? 'rgba(59,130,246,0.12)' : 'rgba(168,85,247,0.12)';
                    const borderThemeColor = isWeekly ? 'rgba(14,165,233,0.18)' : isMonthly ? 'rgba(59,130,246,0.18)' : 'rgba(168,85,247,0.22)';
                    const glowOrbColor = isWeekly ? 'rgba(14,165,233,0.06)' : isMonthly ? 'rgba(59,130,246,0.06)' : 'rgba(168,85,247,0.06)';

                    return (
                      <AnimatedPressable
                        key={pkg._id}
                        style={[
                          styles.packageCard,
                          {
                            borderColor: borderThemeColor,
                            borderLeftColor: themeColor,
                            shadowColor: themeColor,
                          }
                        ]}
                        contentStyle={{ alignItems: 'stretch' }}
                        onPress={() => {
                          router.push({
                            pathname: '/(tabs)/reservations',
                            params: { buildingId, packageId: pkg._id, vehicleType },
                          });
                        }}
                      >
                        {/* Row 1: Tag + Vehicle (Left), Price (Right) */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
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
                          <Text style={styles.packagePrice}>
                            {pkg.price.toLocaleString('en-US')} VND
                          </Text>
                        </View>

                        {/* Row 2: Name (Left), Chevron (Right) */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                          <Text style={[styles.packageName, { flex: 1, marginRight: 8 }]} numberOfLines={1}>
                            {pkg.name} Package
                          </Text>
                          <Ionicons name="chevron-forward" size={14} color={Colors.textDim} />
                        </View>

                        {/* Row 3: Building & Duration (Left), Subscribe button (Right) */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="business-outline" size={12} color={Colors.textDim} />
                              <Text style={styles.packageBuildingName} numberOfLines={1}>
                                {buildingName}
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="time-outline" size={12} color={Colors.textDim} />
                              <Text style={styles.packageBuilding} numberOfLines={1}>
                                {pkg.durationDays} Days
                              </Text>
                            </View>
                          </View>

                          <View style={[styles.packageActionBtnContainer, { backgroundColor: themeColor, paddingHorizontal: 10, paddingVertical: 4 }]}>
                            <Text style={[styles.packageActionBtnText, { fontSize: 9 }]}>Subscribe</Text>
                            <Ionicons name="arrow-forward" size={9} color="#ffffff" />
                          </View>
                        </View>
                      </AnimatedPressable>
                    );
                  })}

                {/* View All button */}
                <TouchableOpacity
                  style={styles.viewAllButton}
                  onPress={() => router.push('/(tabs)/packages')}
                >
                  <Text style={styles.viewAllButtonText}>
                    View All Packages ({packages.length}) →
                  </Text>
                </TouchableOpacity>
              </View>
            )}

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
          </View>
        </ScrollView>

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

        <HomeNotificationsModal
          visible={showNotifications}
          onClose={() => setShowNotifications(false)}
          notifications={notifications}
          onNotificationTap={handleNotificationTap}
          unreadCount={unreadCount}
          onMarkAllRead={handleMarkAllAsRead}
        />
      </View>
    </SafeAreaView>
  );
}

function getTimeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
