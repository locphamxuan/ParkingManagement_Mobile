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
import { listReservations } from '../services/reservations';
import { listParkingHistory } from '../services/history';
import { listPackages } from '../services/longTerm';
import { listNotifications, markNotificationRead } from '../services/notifications';
import { useUIStore } from '../store/uiStore';
import type { WalletInfo, Reservation, ParkingSession, LongTermPackage, Notification } from '../types';

/**
 * State + tải dữ liệu + hiệu ứng (reanimated) cho màn Trang chủ (HomeScreen).
 * Tách khỏi component để phần JSX thuần trình bày.
 */
export function useHomeScreen() {
  const router = useRouter();
  const { session, logout } = useAuthStore();

  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [activeReservations, setActiveReservations] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSession, setActiveSession] = useState<ParkingSession | null>(null);
  const [packages, setPackages] = useState<LongTermPackage[]>([]);
  const [showQR, setShowQR] = useState(false);
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
  const floatValue = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.8);
  const bellRotation = useSharedValue(0);
  const bellScale = useSharedValue(1);

  useEffect(() => {
    heroOpacity.value = withTiming(1, { duration: 600 });
    heroTranslateY.value = withTiming(0, { duration: 600 });
    floatValue.value = withRepeat(
      withSequence(withTiming(1, { duration: 2500 }), withTiming(0, { duration: 2500 })),
      -1,
      true,
    );
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
    const floatY = -5 * floatValue.value;
    return {
      opacity: heroOpacity.value,
      transform: [
        { perspective: 1000 },
        { translateY: heroTranslateY.value + floatY },
        { rotateX: `${1.2 * floatValue.value}deg` },
        { rotateY: `${-1.2 * floatValue.value}deg` },
      ],
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
      const [w, rs, h, pkgs, notifs] = await Promise.allSettled([
        getWallet(session.token),
        listReservations(session.token),
        listParkingHistory(session.token),
        listPackages(session.token),
        listNotifications(session.token),
      ]);
      if (w.status === 'fulfilled') setWallet(w.value);
      if (rs.status === 'fulfilled') {
        setActiveReservations(rs.value.filter((r: Reservation) => r.status === 'confirmed').length);
      }
      if (h.status === 'fulfilled') {
        const active = h.value.find((s: ParkingSession) => s.status === 'active');
        setActiveSession(active ?? null);
      }
      if (pkgs.status === 'fulfilled') {
        setPackages(pkgs.value.filter((p) => p.isActive));
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

  const handleNotificationTap = async (notif: Notification) => {
    if (!notif.isRead) await handleMarkAsRead(notif._id);
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

  return {
    router, session, logout,
    wallet, activeReservations, refreshing, activeSession, packages,
    showQR, setShowQR, notifications, unreadCount,
    showNotifications, setShowNotifications, bellAlertActive,
    heroStyle, pulseDotStyle, bellAnimatedStyle,
    handleMarkAsRead, handleNotificationTap, handleBellPress, onRefresh,
    plateCount,
  };
}
