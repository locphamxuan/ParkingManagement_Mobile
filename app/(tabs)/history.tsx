import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { listParkingHistory } from '../../services/history';
import { Badge } from '../../components/ui/Badge';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { commonStyles, Colors } from '../../styles/common';
import { styles } from '../../styles/screens/history';
import type { ParkingSession } from '../../types';
import { DateRangePicker } from '../../components/ui/DateRangePicker';
import FeedbackModal from '../../components/shared/FeedbackModal';

function fmtDate(s?: string) {
  if (!s) return '—';
  return new Date(s).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtDuration(checkIn: string, checkOut?: string): string {
  if (!checkOut) return 'In progress';
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m > 0 ? ` ${m}m` : ''}`;
}

function AnimatedCard({
  children,
  index,
  style,
}: {
  children: React.ReactNode;
  index: number;
  style?: any;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(15);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    opacity.value = withDelay(index * 60, withTiming(1, { duration: 400 }));
    translateY.value = withDelay(index * 60, withTiming(0, { duration: 400 }));
  }, [index]);

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

export default function HistoryScreen() {
  const { session } = useAuthStore();
  const token = session?.token ?? '';

  const [sessions, setSessions] = useState<ParkingSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackSession, setFeedbackSession] = useState<ParkingSession | null>(null);

  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await listParkingHistory(token);
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filteredSessions = sessions.filter((s) => {
    if (!fromDate) return true;
    const end = toDate ?? new Date();
    const startOfDay = new Date(fromDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(end);
    endOfDay.setHours(23, 59, 59, 999);
    const d = new Date(s.checkIn);
    return d >= startOfDay && d <= endOfDay;
  });

  return (
    <SafeAreaView style={commonStyles.screen} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        <Text style={styles.pageTitle}>Parking History</Text>

        <ErrorBanner message={error} />

        <DateRangePicker
          fromDate={fromDate}
          toDate={toDate}
          onFromChange={setFromDate}
          onToChange={setToDate}
        />

        {filteredSessions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="car-outline" size={32} color={Colors.textDim} />
            <Text style={styles.emptyText}>
              {sessions.length === 0
                ? 'No parking sessions yet.'
                : 'No sessions found in this date range.'}
            </Text>
          </View>
        ) : (
          filteredSessions.map((s, idx) => (
            <AnimatedCard key={s._id} index={idx} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.plateTxt}>{s.plateNumber}</Text>
                  {s.building ? <Text style={styles.subTxt}>{s.building.name}</Text> : null}
                  {s.slot ? <Text style={styles.subTxt}>Slot {s.slot.code}</Text> : null}
                </View>
                <Badge
                  label={s.status === 'active' ? 'Active' : 'Done'}
                  variant={s.status === 'active' ? 'success' : 'default'}
                />
              </View>

              <View style={commonStyles.divider} />

              <View style={styles.infoGrid}>
                <View style={styles.infoCell}>
                  <Text style={styles.infoLabel}>CHECK-IN</Text>
                  <Text style={styles.infoValue}>{fmtDate(s.checkIn)}</Text>
                </View>
                <View style={styles.infoCell}>
                  <Text style={styles.infoLabel}>CHECK-OUT</Text>
                  <Text style={styles.infoValue}>{fmtDate(s.checkOut)}</Text>
                </View>
                <View style={styles.infoCell}>
                  <Text style={styles.infoLabel}>DURATION</Text>
                  <Text style={styles.infoValue}>{fmtDuration(s.checkIn, s.checkOut)}</Text>
                </View>
                {s.fee !== undefined ? (
                  <View style={styles.infoCell}>
                    <Text style={styles.infoLabel}>FEE</Text>
                    <Text style={[styles.infoValue, { color: Colors.primary }]}>
                      {s.fee.toLocaleString('en-US')} VND
                    </Text>
                  </View>
                ) : null}
              </View>

              {s.status !== 'active' ? (
                <TouchableOpacity
                  style={styles.feedbackBtn}
                  onPress={() => setFeedbackSession(s)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="star-outline" size={16} color="#020617" />
                  <Text style={styles.feedbackBtnText}>Rate your parking experience</Text>
                </TouchableOpacity>
              ) : null}
            </AnimatedCard>
          ))
        )}
      </ScrollView>

      <FeedbackModal
        visible={feedbackSession !== null}
        session={feedbackSession}
        token={token}
        onClose={() => setFeedbackSession(null)}
        onSuccess={() => {
          setFeedbackSession(null);
          void load();
        }}
      />
    </SafeAreaView>
  );
}
