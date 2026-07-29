import { useEffect, useState } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { getWallet } from '../services/wallet';
import { listParkingHistory } from '../services/history';
import { listPackages, listSubscriptions } from '../services/longTerm';
import { listNotifications, markNotificationRead, markAllNotificationsRead } from '../services/notifications';
import { listPlates } from '../services/plates';
import { useUIStore } from '../store/uiStore';
import type { WalletInfo, Reservation, ParkingSession, LongTermPackage, Notification } from '../types';

/**
 * State + tải dữ liệu + hiệu ứng (reanimated) cho màn Trang chủ (HomeScreen).
 * Tách khỏi component để phần JSX thuần trình bày.
 */
export function useHomeScreen() {
  const router = useRouter();
  const { session, logout, updateProfile } = useAuthStore();

  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [activeReservations, setActiveReservations] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSession, setActiveSession] = useState<ParkingSession | null>(null);
  const [packages, setPackages] = useState<LongTermPackage[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showVehicleQr, setShowVehicleQr] = useState(false);
  const [loadingVehicleQr, setLoadingVehicleQr] = useState(false);
  const [bellAlertActive, setBellAlertActive] = useState(false);

  const setTabBarHidden = useUIStore((state) => state.setTabBarHidden);

  useEffect(() => {
    setTabBarHidden(showNotifications || showVehicleQr);
    return () => setTabBarHidden(false);
  }, [showNotifications, showVehicleQr, setTabBarHidden]);

  // Animations Shared Values
  const heroOpacity = useSharedValue(0);
  const heroTranslateY = useSharedValue(15);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.8);
  const bellRotation = useSharedValue(0);
  const bellScale = useSharedValue(1);

  useEffect(() => {
    heroOpacity.value = withTiming(1, { duration: 600 });
    heroTranslateY.value = withTiming(0, { duration: 600 });
    pulseScale.value = withRepeat(
      withSequence(withTiming(1.6, { duration: 1000 }), withTiming(1, { duration: 1000 })),
      -1,
      false,
    );
    pulseOpacity.value = withRepeat(
      withSequence(withTiming(0.2, { duration: 1000 }), withTiming(0.8, { duration: 1000 })),
      -1,
      false,
    );
  }, []);

  useEffect(() => {
    if (bellAlertActive) {
      bellRotation.value = withRepeat(
        withSequence(
          withTiming(-12, { duration: 80 }),
          withTiming(12, { duration: 160 }),
          withTiming(-10, { duration: 160 }),
          withTiming(10, { duration: 160 }),
          withTiming(-6, { duration: 160 }),
          withTiming(6, { duration: 160 }),
          withTiming(0, { duration: 160 }),
          withDelay(1200, withTiming(0, { duration: 100 })),
        ),
        -1,
        false,
      );
      bellScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 400 }),
          withTiming(1, { duration: 400 }),
          withDelay(1200, withTiming(1, { duration: 100 })),
        ),
        -1,
        false,
      );
    } else {
      bellRotation.value = withTiming(0, { duration: 200 });
      bellScale.value = withTiming(1, { duration: 200 });
    }
  }, [bellAlertActive]);

  const heroStyle = useAnimatedStyle(() => {
    return {
      opacity: heroOpacity.value,
      transform: [{ translateY: heroTranslateY.value }],
    };
  });

  const pulseDotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const bellAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${bellRotation.value}deg` }, { scale: bellScale.value }],
  }));

  const load = async () => {
    if (!session?.token) return;
    try {
      const [w, subsRes, h, pkgs, notifs] = await Promise.allSettled([
        getWallet(session.token),
        listSubscriptions(session.token),
        listParkingHistory(session.token),
        listPackages(session.token),
        listNotifications(session.token),
      ]);
      if (w.status === 'fulfilled') setWallet(w.value);
      if (subsRes.status === 'fulfilled') {
        setActiveReservations(subsRes.value.filter((s: any) => s.status === 'active').length);
      }
      if (h.status === 'fulfilled') {
        const active = h.value.find((s: ParkingSession) => s.status === 'active');
        setActiveSession(active ?? null);
      }
      if (pkgs.status === 'fulfilled') {
        setPackages(
          pkgs.value.filter((p) => p.isActive && Boolean(p.building?._id && p.building?.name)),
        );
      }
      if (notifs.status === 'fulfilled') {
        setNotifications(notifs.value.items);
        const unread = notifs.value.unread;
        setUnreadCount(unread);
        if (unread > 0) setBellAlertActive(true);
      }
    } catch {
      // silently fail
    }
  };

  const handleMarkAsRead = async (notifId: string) => {
    if (!session?.token) return;
    try {
      await markNotificationRead(session.token, notifId);
      setNotifications((prev) => prev.map((n) => (n._id === notifId ? { ...n, isRead: true } : n)));
      setUnreadCount((prev) => {
        const next = Math.max(0, prev - 1);
        if (next === 0) setBellAlertActive(false);
        return next;
      });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!session?.token) return;
    try {
      await markAllNotificationsRead(session.token);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      setBellAlertActive(false);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const handleNotificationTap = async (notif: Notification) => {
    if (!notif.isRead) await handleMarkAsRead(notif._id);
    setShowNotifications(false);
    router.push('/(tabs)/packages');
  };

  const handleBellPress = () => {
    setShowNotifications(true);
    setBellAlertActive(false);
  };

  const handleOpenVehicleQr = async () => {
    setShowVehicleQr(true);
    if (!session?.token) return;

    setLoadingVehicleQr(true);
    try {
      // Refresh on entry so a recently-added vehicle and its own QR are never stale.
      const licensePlates = await listPlates(session.token);
      updateProfile({ licensePlates });
    } catch {
      // The sheet can still show the vehicle list already held in the session.
    } finally {
      setLoadingVehicleQr(false);
    }
  };

  useEffect(() => { load(); }, [session?.token]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const plateCount = session?.licensePlates?.length ?? 0;

  return {
    router, session, logout,
    wallet, activeReservations, refreshing, activeSession, packages,
    notifications, unreadCount,
    showNotifications, setShowNotifications, showVehicleQr, setShowVehicleQr, loadingVehicleQr, bellAlertActive,
    heroStyle, pulseDotStyle, bellAnimatedStyle,
    handleMarkAsRead, handleMarkAllAsRead, handleNotificationTap, handleBellPress, handleOpenVehicleQr, onRefresh,
    plateCount,
  };
}
