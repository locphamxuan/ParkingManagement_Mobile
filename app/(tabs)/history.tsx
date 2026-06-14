import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { listParkingHistory } from '../../services/history';
import { Badge } from '../../components/ui/Badge';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import type { ParkingSession } from '../../types';
import { DateRangePicker } from '../../components/ui/DateRangePicker';

function fmtDate(s?: string) {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-US', {
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

function AnimatedCard({ children, index, style }: { children: React.ReactNode; index: number; style?: any }) {
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

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

export default function HistoryScreen() {
  const { session } = useAuthStore();
  const token = session?.token ?? '';

  const [sessions, setSessions] = useState<ParkingSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Date range state
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

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        <Text style={styles.pageTitle}>Parking History</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <DateRangePicker
          fromDate={fromDate}
          toDate={toDate}
          onFromChange={setFromDate}
          onToChange={setToDate}
        />

        {(() => {
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

          if (filteredSessions.length === 0) {
            return (
              <View style={styles.emptyCard}>
                <Ionicons name="car-outline" size={32} color={Colors.textDim} />
                <Text style={styles.emptyText}>
                  {sessions.length === 0 ? 'No parking sessions yet.' : 'No sessions found in this date range.'}
                </Text>
              </View>
            );
          }

          return filteredSessions.map((s, idx) => (
            <AnimatedCard key={s._id} index={idx} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.plateTxt}>{s.plateNumber}</Text>
                  {s.building && (
                    <Text style={styles.subTxt}>{s.building.name}</Text>
                  )}
                  {s.slot && (
                    <Text style={styles.subTxt}>Slot {s.slot.code}</Text>
                  )}
                </View>
                <Badge
                  label={s.status === 'active' ? 'Active' : 'Done'}
                  variant={s.status === 'active' ? 'success' : 'default'}
                />
              </View>

              <View style={styles.divider} />

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
                {s.fee !== undefined && (
                  <View style={styles.infoCell}>
                    <Text style={styles.infoLabel}>FEE</Text>
                    <Text style={[styles.infoValue, { color: Colors.primary }]}>
                      {s.fee.toLocaleString('en-US')} VND
                    </Text>
                  </View>
                )}
              </View>
            </AnimatedCard>
          ));
        })()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: 32,
    gap: Spacing.lg,
  },
  pageTitle: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.text },
  errorBox: {
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    padding: Spacing.md,
  },
  errorText: { color: Colors.error, fontSize: FontSize.sm, fontWeight: '600' },
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing['2xl'],
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyText: { color: Colors.textDim, fontSize: FontSize.sm },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  plateTxt: { fontSize: FontSize.base, fontWeight: '800', color: Colors.text, fontFamily: 'monospace' },
  subTxt: { fontSize: FontSize.xs, color: Colors.textMuted },
  divider: { height: 1, backgroundColor: Colors.border },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  infoCell: { minWidth: '40%', gap: 3 },
  infoLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoValue: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted },
});
