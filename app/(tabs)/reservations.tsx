import {
  View,
  Text,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { Colors } from '../../constants/theme';
import { styles } from '../../styles/screens/reservations';
import { DateRangePicker } from '../../components/ui/DateRangePicker';
import { type FilterStatus } from '../../utils/reservationFormat';
import { AnimatedPressable } from '../../components/reservations/animations';
import { CustomDialog } from '../../components/reservations/CustomDialog';
import { ReservationCard } from '../../components/reservations/ReservationCard';
import { ReservationWizard } from '../../components/reservations/ReservationWizard';
import { useReservations } from '../../hooks/useReservations';

// Logic tách sang hooks/useReservations; wizard + card + dialog tách sang components/reservations/*.
export default function ReservationsScreen() {
  const vm = useReservations();
  const {
    refreshing, onRefresh, loadError, filter, setFilter,
    fromDate, setFromDate, toDate, setToDate,
    filtered, finalFiltered,
    cancellingId, renewingId, handleCancel, handleRenewSubscription,
    openWizard,
    dialog, dismissDialog,
  } = vm;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        <View style={styles.topRow}>
          <Text style={styles.pageTitle}>Reservations</Text>
          <Button label="+ New" onPress={openWizard} size="sm" />
        </View>

        {loadError ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={Colors.error} style={{ marginRight: 6 }} />
            <Text style={styles.errorText}>{loadError}</Text>
          </View>
        ) : null}

        <View style={styles.filterRow}>
          {([
            { key: 'booked', label: 'Booked' },
            { key: 'cancelled', label: 'Cancelled' },
          ] as { key: FilterStatus; label: string }[]).map(({ key, label }) => (
            <AnimatedPressable
              key={key}
              style={[styles.filterBtn, styles.filterBtnFlex, filter === key && styles.filterBtnActive]}
              onPress={() => setFilter(key)}
            >
              <Text style={[styles.filterText, filter === key && styles.filterTextActive]}>
                {label}
              </Text>
            </AnimatedPressable>
          ))}
        </View>

        <DateRangePicker
          fromDate={fromDate}
          toDate={toDate}
          onFromChange={setFromDate}
          onToChange={setToDate}
        />

        {finalFiltered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={32} color={Colors.textDim} />
            <Text style={styles.emptyText}>
              {filtered.length === 0 ? 'No reservations found.' : 'No reservations found in this date range.'}
            </Text>
          </View>
        ) : (
          finalFiltered.map((r, idx) => (
            <ReservationCard
              key={r._id}
              r={r}
              index={idx}
              cancellingId={cancellingId}
              renewingId={renewingId}
              onCancel={handleCancel}
              onRenew={handleRenewSubscription}
            />
          ))
        )}
      </ScrollView>

      {/* ── Wizard + BookingDate modals ────────────────────────────────────────── */}
      <ReservationWizard vm={vm} />

      {/* ── Custom Dialog Modal ────────────────────────────────────────────────── */}
      <CustomDialog dialog={dialog} onDismiss={dismissDialog} />

    </SafeAreaView>
  );
}
