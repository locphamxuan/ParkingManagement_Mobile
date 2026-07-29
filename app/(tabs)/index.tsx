import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Gradients } from '../../constants/theme';
import { styles } from '../../styles/screens/index';
import NotificationBellStream from '../../components/shared/NotificationBellStream';
import { useHomeScreen } from '../../hooks/useHomeScreen';
import { useFocusedStatusBarStyle } from '../../hooks/useFocusedStatusBarStyle';
import { HomeNotificationsModal } from '../../components/home/HomeNotificationsModal';
import { VehicleQrModal } from '../../components/home/VehicleQrModal';
import { AnimatedPressable } from '../../components/ui/AnimatedCard';
import { GradientView } from '../../components/ui/GradientView';
import { vehicleCategoryFromVehicleType } from '../../utils/vehicle';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const QUICK_ACTIONS: {
  icon: IoniconName;
  label: string;
  route: '/incidents' | '/buildings' | '/(tabs)/wallet' | '/(tabs)/packages';
  color: string;
  tint: string;
}[] = [
  { icon: 'alert-circle-outline', label: 'Incidents', route: '/incidents', color: Colors.error, tint: 'rgba(220,38,38,0.10)' },
  { icon: 'business-outline', label: 'Buildings', route: '/buildings', color: Colors.success, tint: 'rgba(22,163,74,0.10)' },
  { icon: 'add-circle-outline', label: 'Top Up', route: '/(tabs)/wallet', color: Colors.primary, tint: 'rgba(11,111,230,0.10)' },
  { icon: 'cube-outline', label: 'Packages', route: '/(tabs)/packages', color: Colors.purple, tint: 'rgba(124,58,237,0.10)' },
];

function QuickLink({
  icon,
  label,
  onPress,
  color,
  tint,
}: {
  icon: IoniconName;
  label: string;
  onPress: () => void;
  color: string;
  tint: string;
}) {
  return (
    <AnimatedPressable style={styles.quickLink} onPress={onPress}>
      <View style={[styles.quickLinkInner, { borderColor: color }]}>
        <View style={[styles.quickLinkIcon, { backgroundColor: tint }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={styles.quickLinkLabel} numberOfLines={1}>{label}</Text>
      </View>
    </AnimatedPressable>
  );
}

export default function HomeScreen() {
  const {
    router, session, logout, wallet, activePackageCount, refreshing, activeSession, packages,
    notifications, unreadCount, showNotifications, setShowNotifications, showVehicleQr, setShowVehicleQr, loadingVehicleQr,
    heroStyle, pulseDotStyle, bellAnimatedStyle,
    handleNotificationTap, handleMarkAllAsRead, handleBellPress, handleOpenVehicleQr, onRefresh, plateCount,
  } = useHomeScreen();

  useFocusedStatusBarStyle('light');

  const cardHolder = session?.displayName
    ? session.displayName.toUpperCase()
    : session?.email
      ? session.email.split('@')[0].toUpperCase()
      : 'PBMS MEMBER';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.primary }} edges={['top']}>
      <View style={styles.safe}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
        >
          <GradientView colors={Gradients.header} direction="diagonal" style={styles.hero}>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.greeting}>Good {getTimeGreeting()}!</Text>
                <Text style={styles.name} numberOfLines={1}>
                  {session?.displayName || 'User'}
                </Text>
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.bellBtn}
                  onPress={handleBellPress}
                  accessibilityRole="button"
                  accessibilityLabel={
                    unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
                  }
                >
                  <Animated.View style={bellAnimatedStyle}>
                    <Ionicons name="notifications-outline" size={22} color="#ffffff" />
                  </Animated.View>
                  {unreadCount > 0 && (
                    <View style={styles.badgeContainer}>
                      <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <NotificationBellStream token={session?.token ?? ''} headerVariant />

                <TouchableOpacity
                  style={styles.logoutBtn}
                  onPress={logout}
                  accessibilityRole="button"
                  accessibilityLabel="Sign out"
                >
                  <Ionicons name="log-out-outline" size={16} color={Colors.error} />
                  <Text style={styles.logoutText}>Sign out</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Animated.View style={[styles.heroCard, heroStyle]}>
              <View>
                <Text style={styles.heroLabel}>Wallet balance</Text>
                <Text style={styles.heroValue}>
                  {wallet !== null ? `${wallet.balance.toLocaleString('en-US')} VND` : '—'}
                </Text>
              </View>

              <View style={styles.cardFooterRow}>
                <Text style={styles.cardHolderName} numberOfLines={1}>{cardHolder}</Text>
                <View style={styles.brandBadge}>
                  <View style={styles.brandChip}>
                    <Text style={styles.brandChipText}>P</Text>
                  </View>
                  <View>
                    <Text style={styles.brandText}>PBMS</Text>
                    <Text style={styles.brandText}>PAYMENT</Text>
                  </View>
                </View>
              </View>

              {activePackageCount > 0 && (
                <View style={styles.heroPackageBadge}>
                  <Ionicons name="calendar-outline" size={13} color="#ffffff" />
                  <Text style={styles.heroPackageText}>
                    {activePackageCount} active package{activePackageCount !== 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </Animated.View>
          </GradientView>

          <View style={styles.body}>
            {activeSession && (
              <View style={styles.activeSessionCard}>
                <View style={styles.activeCardHeader}>
                  <Text style={styles.activeSessionTitle}>Active parking</Text>
                  <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success }, pulseDotStyle]} />
                </View>

                <View style={styles.activeBuildingRow}>
                  <Ionicons name="business-outline" size={18} color={Colors.primary} />
                  <Text style={styles.activeBuildingText} numberOfLines={1}>
                    {activeSession.building?.name ?? 'PBMS Parking'}
                  </Text>
                </View>

                <View style={styles.activeStatsRow}>
                  <View style={styles.activeStat}>
                    <Text style={styles.activeStatValue} numberOfLines={1}>{activeSession.plateNumber}</Text>
                    <Text style={styles.activeStatLabel}>Vehicle Plate</Text>
                  </View>
                  <View style={styles.activeStat}>
                    <Text style={styles.activeStatValue} numberOfLines={1}>{activeSession.slot?.code ?? '—'}</Text>
                    <Text style={styles.activeStatLabel}>Slot</Text>
                  </View>
                  <View style={styles.activeStat}>
                    <Text style={styles.activeStatValue} numberOfLines={1}>
                      {new Date(activeSession.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <Text style={styles.activeStatLabel}>Checked-in</Text>
                  </View>
                </View>
              </View>
            )}

            {session?.role?.toLowerCase() === 'user' ? (
              <AnimatedPressable
                style={styles.qrShortcutCard}
                onPress={handleOpenVehicleQr}
                accessibilityLabel="Choose a vehicle and view its QR code"
              >
                <View style={styles.qrShortcutRow}>
                  <View style={styles.qrShortcutLeft}>
                    <View style={styles.qrShortcutIconContainer}>
                      <Ionicons name="qr-code-outline" size={22} color={Colors.primary} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.qrShortcutTitle}>Vehicle QR Codes</Text>
                      <Text style={styles.qrShortcutSubtitle} numberOfLines={1}>
                        One secure QR code for each registered vehicle
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textDim} />
                </View>
              </AnimatedPressable>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.quickRow}>
                {QUICK_ACTIONS.map((action) => (
                  <QuickLink
                    key={action.label}
                    icon={action.icon}
                    label={action.label}
                    color={action.color}
                    tint={action.tint}
                    onPress={() => router.push(action.route)}
                  />
                ))}
              </View>
            </View>

            {packages.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Subscription Packages</Text>
                  <TouchableOpacity
                    onPress={() => router.push('/(tabs)/packages')}
                    accessibilityRole="button"
                    accessibilityLabel={`View all ${packages.length} packages`}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.sectionLink}>View all</Text>
                  </TouchableOpacity>
                </View>

                {packages
                  .slice()
                  .sort((a, b) => a.price - b.price)
                  .slice(0, 4)
                  .map((pkg) => {
                    const isCar = vehicleCategoryFromVehicleType(pkg.vehicleType) === 'car';
                    const isWeekly = pkg.durationDays <= 7;
                    const isMonthly = pkg.durationDays <= 30 && pkg.durationDays > 7;
                    const tagLabel = isWeekly ? 'Weekly' : isMonthly ? 'Monthly' : 'Yearly';
                    const buildingName = typeof pkg.building === 'object' && pkg.building
                      ? pkg.building.name : 'All Buildings';
                    const buildingId = typeof pkg.building === 'object' && pkg.building ? pkg.building._id : '';
                    const vehicleType = typeof pkg.vehicleType === 'object' && pkg.vehicleType ? pkg.vehicleType.code : 'car';

                    const themeColor = isWeekly ? Colors.primary : isMonthly ? Colors.blue : Colors.purple;
                    const themeBg = isWeekly ? 'rgba(11,111,230,0.10)' : isMonthly ? 'rgba(37,99,237,0.10)' : 'rgba(124,58,237,0.10)';

                    return (
                      <AnimatedPressable
                        key={pkg._id}
                        style={[styles.packageCard, { borderLeftColor: themeColor }]}
                        contentStyle={{ alignItems: 'stretch' }}
                        onPress={() => {
                          router.push({
                            pathname: '/(tabs)/packages',
                            params: { buildingId, packageId: pkg._id, vehicleType },
                          });
                        }}
                      >
                        <View style={styles.packageTopRow}>
                          <View style={styles.packageTagRow}>
                            <Text style={[styles.packageTag, { backgroundColor: themeBg, color: themeColor }]}>
                              {tagLabel}
                            </Text>
                            <View style={[
                              styles.packageVehicleBadge,
                              { borderColor: isCar ? 'rgba(37,99,237,0.25)' : 'rgba(22,163,74,0.25)' },
                            ]}>
                              <Ionicons name={isCar ? 'car' : 'bicycle'} size={10} color={isCar ? Colors.blue : Colors.success} />
                              <Text style={[styles.packageVehicleText, { color: isCar ? Colors.blue : Colors.success }]}>
                                {isCar ? 'Car' : 'Motorcycle'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.packagePrice}>{pkg.price.toLocaleString('en-US')} VND</Text>
                        </View>

                        <View style={styles.packageTopRow}>
                          <Text style={styles.packageName} numberOfLines={1}>{pkg.name} Package</Text>
                          <Ionicons name="chevron-forward" size={16} color={Colors.textDim} />
                        </View>

                        <View style={styles.packageTopRow}>
                          <View style={styles.packageMetaRow}>
                            <View style={styles.packageMetaItem}>
                              <Ionicons name="business-outline" size={12} color={Colors.textDim} />
                              <Text style={styles.packageMetaText} numberOfLines={1}>{buildingName}</Text>
                            </View>
                            <View style={styles.packageMetaItem}>
                              <Ionicons name="time-outline" size={12} color={Colors.textDim} />
                              <Text style={styles.packageMetaText}>{pkg.durationDays} Days</Text>
                            </View>
                          </View>

                          <View style={[styles.packageActionBtnContainer, { backgroundColor: themeColor }]}>
                            <Text style={styles.packageActionBtnText}>Subscribe</Text>
                            <Ionicons name="arrow-forward" size={10} color="#ffffff" />
                          </View>
                        </View>
                      </AnimatedPressable>
                    );
                  })}
              </View>
            )}

            {plateCount === 0 && (
              <View style={styles.warningBox}>
                <Ionicons name="alert-circle" size={20} color={Colors.warning} />
                <View style={styles.warningContent}>
                  <Text style={styles.warningTitle}>Incomplete Profile</Text>
                  <Text style={styles.warningText}>
                    Add a license plate so PBMS can identify your vehicle automatically.
                  </Text>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} accessibilityRole="button">
                    <Text style={styles.warningLink}>Go to Profile →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        <HomeNotificationsModal
          visible={showNotifications}
          onClose={() => setShowNotifications(false)}
          notifications={notifications}
          onNotificationTap={handleNotificationTap}
          unreadCount={unreadCount}
          onMarkAllRead={handleMarkAllAsRead}
        />
        <VehicleQrModal
          visible={showVehicleQr}
          plates={session?.licensePlates ?? []}
          loading={loadingVehicleQr}
          onClose={() => setShowVehicleQr(false)}
          onManageVehicles={() => {
            setShowVehicleQr(false);
            router.push({ pathname: '/(tabs)/profile', params: { tab: 'plates' } });
          }}
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
