import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import {
  listReservations,
  createReservation,
  cancelReservation,
  listBuildings,
  getBuildingVehicleTypes,
} from '../../services/reservations';
import type { BuildingOption, VehicleTypeOption } from '../../services/reservations';
import {
  getBuildingFloors,
  getFloorSlots,
} from '../../services/floors';
import type { FloorWithAvailability, SlotItem, FloorGate } from '../../services/floors';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import type { Reservation } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  return new Date(s).toLocaleString('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const CANCELLED_STATUSES: Reservation['status'][] = ['cancelled', 'expired'];

function isCancelled(status: Reservation['status']) {
  return CANCELLED_STATUSES.includes(status);
}

function statusVariant(status: Reservation['status']) {
  return isCancelled(status) ? 'error' : 'info';
}

function statusLabel(status: Reservation['status']) {
  return isCancelled(status) ? 'Cancelled' : 'Booked';
}

function fmtVND(amount: number) {
  return amount.toLocaleString('en-US') + ' VND';
}

// Infer car/motorcycle from vehicle type name since the model has no category field
function guessVehicleCategory(name: string): 'car' | 'motorcycle' | null {
  const lower = name.toLowerCase();
  if (lower.includes('motor') || lower.includes('moto') || lower.includes('xe máy') || lower.includes('xe may') || lower.includes('bike')) return 'motorcycle';
  if (lower.includes('car') || lower.includes('ô tô') || lower.includes('o to') || lower.includes('auto') || lower.includes('truck') || lower.includes('van') || lower.includes('suv')) return 'car';
  return null;
}

// A floor is bookable only if it has at least one entry gate (in/both) assigned.
function floorHasEntryGate(floor: { gates?: FloorGate[] } | undefined | null): boolean {
  return (floor?.gates ?? []).some((g) => g.direction === 'in' || g.direction === 'both');
}

interface GroupedRow {
  rowLabel: string;
  slots: SlotItem[];
}

function groupSlotsIntoGrid(slots: SlotItem[]): GroupedRow[] {
  let hasAlphabetic = false;
  for (const s of slots) {
    if (/[A-Za-z]/.test(s.code)) {
      hasAlphabetic = true;
      break;
    }
  }

  if (hasAlphabetic) {
    const rowsMap: { [key: string]: SlotItem[] } = {};
    for (const s of slots) {
      const match = s.code.match(/^([A-Za-z]+)?(\d+)?(.*)$/);
      const rowLabel = match && match[1] ? match[1].toUpperCase() : 'A';
      if (!rowsMap[rowLabel]) {
        rowsMap[rowLabel] = [];
      }
      rowsMap[rowLabel].push(s);
    }

    for (const rowLabel of Object.keys(rowsMap)) {
      rowsMap[rowLabel].sort((a, b) => {
        const numA = parseInt(a.code.replace(/^\D+/g, ''), 10) || 0;
        const numB = parseInt(b.code.replace(/^\D+/g, ''), 10) || 0;
        return numA - numB;
      });
    }

    const sortedRowLabels = Object.keys(rowsMap).sort();
    return sortedRowLabels.map((rowLabel) => ({
      rowLabel,
      slots: rowsMap[rowLabel],
    }));
  } else {
    const sortedSlots = [...slots].sort((a, b) => {
      const numA = parseInt(a.code, 10) || 0;
      const numB = parseInt(b.code, 10) || 0;
      return numA - numB;
    });

    const rows: GroupedRow[] = [];
    const chunkSize = 3;
    for (let i = 0; i < sortedSlots.length; i += chunkSize) {
      const chunk = sortedSlots.slice(i, i + chunkSize);
      const rowNum = Math.floor(i / chunkSize) + 1;
      rows.push({
        rowLabel: `Row ${rowNum}`,
        slots: chunk,
      });
    }
    return rows;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterStatus = 'booked' | 'cancelled';
type WizardStep = 1 | 2 | 3;

interface WizardState {
  buildingId: string;
  plateNumber: string;
  vehicleTypeId: string;
  floorId: string;
  slotId: string;
  startTime: string;
  endTime: string;
}

const EMPTY_WIZARD: WizardState = {
  buildingId: '',
  plateNumber: '',
  vehicleTypeId: '',
  floorId: '',
  slotId: '',
  startTime: '',
  endTime: '',
};

// ─── Premium Time Picker Global Helpers ────────────────────────────────────────

function getDayName(d: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[d.getDay()];
}

function getMonthName(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[d.getMonth()];
}

function generateTimeSlots(selectedDate: Date): string[] {
  const slotsList = [];
  const now = new Date();
  
  // Clear time parts for accurate date comparison
  const compareDate = new Date(selectedDate);
  compareDate.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  if (compareDate < today) {
    return []; // No slots for past dates
  }

  const isToday = compareDate.getTime() === today.getTime();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();

  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      if (isToday) {
        if (h < currentHour || (h === currentHour && m <= currentMin)) {
          continue;
        }
      }
      const hStr = h.toString().padStart(2, '0');
      const mStr = m.toString().padStart(2, '0');
      slotsList.push(`${hStr}:${mStr}`);
    }
  }
  return slotsList;
}

function generateNext7Days(): Date[] {
  const list = [];
  const now = new Date();
  
  // Check if today has any valid time slots left
  const todaySlots = generateTimeSlots(now);
  const startOffset = todaySlots.length === 0 ? 1 : 0;
  
  for (let i = startOffset; i < startOffset + 7; i++) {
    const d = new Date();
    d.setDate(now.getDate() + i);
    list.push(d);
  }
  return list;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ReservationsScreen() {
  const { session } = useAuthStore();
  const token = session?.token ?? '';
  const plates = session?.licensePlates ?? [];

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('booked');

  // Wizard state
  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState<WizardStep>(1);
  const [wizard, setWizard] = useState<WizardState>({ ...EMPTY_WIZARD });
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('2D');
  const [showMapModal, setShowMapModal] = useState(false);
  const [displaySlotCode, setDisplaySlotCode] = useState<string>('');

  // Premium Time Picker state
  const [selDate, setSelDate] = useState<Date>(() => {
    const now = new Date();
    const todaySlots = generateTimeSlots(now);
    if (todaySlots.length === 0) {
      const tomorrow = new Date();
      tomorrow.setDate(now.getDate() + 1);
      return tomorrow;
    }
    return now;
  });
  const [selTime, setSelTime] = useState<string>(() => {
    const now = new Date();
    const todaySlots = generateTimeSlots(now);
    if (todaySlots.length === 0) {
      const tomorrow = new Date();
      tomorrow.setDate(now.getDate() + 1);
      const tomorrowSlots = generateTimeSlots(tomorrow);
      return tomorrowSlots.length > 0 ? tomorrowSlots[0] : '08:00';
    }
    return todaySlots.length > 0 ? todaySlots[0] : '08:00';
  });
  const [selDuration, setSelDuration] = useState<number | 'flexible'>(2);

  const updateWizardTimes = (date: Date, time: string, duration: number | 'flexible') => {
    if (!time) return;
    const [hours, mins] = time.split(':').map(Number);
    const start = new Date(date);
    start.setHours(hours, mins, 0, 0);

    const dStr = start.getFullYear() + '-' + 
      String(start.getMonth() + 1).padStart(2, '0') + '-' + 
      String(start.getDate()).padStart(2, '0');
    const tStr = String(start.getHours()).padStart(2, '0') + ':' + 
      String(start.getMinutes()).padStart(2, '0');
    
    let endTimeStr = '';
    if (duration !== 'flexible') {
      const end = new Date(start);
      end.setHours(end.getHours() + duration);
      const endDStr = end.getFullYear() + '-' + 
        String(end.getMonth() + 1).padStart(2, '0') + '-' + 
        String(end.getDate()).padStart(2, '0');
      const endTStr = String(end.getHours()).padStart(2, '0') + ':' + 
        String(end.getMinutes()).padStart(2, '0');
      endTimeStr = `${endDStr} ${endTStr}`;
    }

    setWizard((prev) => ({
      ...prev,
      startTime: `${dStr} ${tStr}`,
      endTime: endTimeStr,
    }));
  };

  const handleDateChange = (date: Date) => {
    setSelDate(date);
    const times = generateTimeSlots(date);
    let newTime = selTime;
    if (times.length > 0) {
      if (!times.includes(selTime)) {
        newTime = times[0];
        setSelTime(times[0]);
      }
    } else {
      newTime = '00:00';
      setSelTime('00:00');
    }
    updateWizardTimes(date, newTime, selDuration);
  };

  const handleTimeChange = (time: string) => {
    setSelTime(time);
    updateWizardTimes(selDate, time, selDuration);
  };

  const handleDurationChange = (dur: number | 'flexible') => {
    setSelDuration(dur);
    updateWizardTimes(selDate, selTime, dur);
  };

  // Step 1 — buildings + vehicle types
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [fetchingBuildings, setFetchingBuildings] = useState(false);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleTypeOption[]>([]);
  const [fetchingVT, setFetchingVT] = useState(false);

  // Step 2 — floors + slots
  const [floors, setFloors] = useState<FloorWithAvailability[]>([]);
  const [fetchingFloors, setFetchingFloors] = useState(false);
  const [floorsError, setFloorsError] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [fetchingSlots, setFetchingSlots] = useState(false);

  // Step 3 — submit
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Cancel state
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // ── Load reservations ──────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!token) return;
    setLoadError(null);
    try {
      const data = await listReservations(token);
      setReservations(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load reservations');
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // ── Cancel ─────────────────────────────────────────────────────────────────

  const doCancel = async (r: Reservation) => {
    setCancellingId(r._id);
    try {
      const { refund } = await cancelReservation(token, r._id);
      await load();
      if (refund > 0) {
        Alert.alert('Reservation Cancelled', `${fmtVND(refund)} (85%) was refunded to your wallet.`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not cancel reservation';
      Alert.alert('Error', msg);
    } finally {
      setCancellingId(null);
    }
  };

  const handleCancel = (r: Reservation) => {
    const msg = `Cancel reservation for plate "${r.plateNumber}"?`;
    if (Platform.OS === 'web') {
      // biome-ignore lint/suspicious/noExplicitAny: web-only globalThis
      if ((globalThis as any).confirm?.(msg)) doCancel(r);
      return;
    }
    Alert.alert('Cancel Reservation', msg, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Cancel Reservation', style: 'destructive', onPress: () => doCancel(r) },
    ]);
  };

  // ── Wizard helpers ─────────────────────────────────────────────────────────

  const openWizard = async () => {
    setStep(1);
    setWizard({ ...EMPTY_WIZARD, plateNumber: plates[0]?.plateNumber ?? '' });
    setVehicleTypes([]);
    setFloors([]);
    setSlots([]);
    setCreateError(null);
    setShowWizard(true);
    setDisplaySlotCode('');

    // Load buildings immediately when wizard opens
    setFetchingBuildings(true);
    try {
      const data = await listBuildings(token);
      setBuildings(data);
    } catch {
      setBuildings([]);
    } finally {
      setFetchingBuildings(false);
    }
  };

  const closeWizard = () => setShowWizard(false);

  // Step 1: building selected → fetch vehicle types, then auto-select a matching plate
  const handleSelectBuilding = async (buildingId: string) => {
    setWizard((p) => ({ ...p, buildingId, vehicleTypeId: '', plateNumber: '' }));
    setVehicleTypes([]);
    if (!buildingId) return;
    try {
      setFetchingVT(true);
      const types = await getBuildingVehicleTypes(token, buildingId);
      setVehicleTypes(types);
      if (types.length > 0) {
        const firstType = types[0];
        const category = guessVehicleCategory(firstType.name);
        // Auto-select first plate that matches this vehicle category
        const matchingPlate = category
          ? plates.find((p) => p.vehicleType === category)
          : plates[0];
        setWizard((p) => ({
          ...p,
          vehicleTypeId: firstType._id,
          plateNumber: matchingPlate?.plateNumber ?? '',
        }));
      }
    } catch {
      setVehicleTypes([]);
    } finally {
      setFetchingVT(false);
    }
  };

  // Step 1 → Step 2
  const goToStep2 = async () => {
    if (!wizard.buildingId) {
      Alert.alert('Missing Info', 'Please select a building.');
      return;
    }
    if (!wizard.vehicleTypeId) {
      Alert.alert('Missing Info', 'Please select a vehicle type.');
      return;
    }
    if (!wizard.plateNumber.trim()) {
      Alert.alert('Missing Info', 'Please select or enter a license plate.');
      return;
    }
    // Validate plate matches the selected vehicle type category
    const selectedVt = vehicleTypes.find((vt) => vt._id === wizard.vehicleTypeId);
    if (selectedVt) {
      const vtCategory = guessVehicleCategory(selectedVt.name);
      const plate = plates.find((p) => p.plateNumber === wizard.plateNumber);
      if (vtCategory && plate && plate.vehicleType !== vtCategory) {
        Alert.alert(
          'Vehicle Mismatch',
          `This building only accepts ${vtCategory === 'motorcycle' ? 'motorcycles' : 'cars'}. Please select a matching plate.`,
        );
        return;
      }
    }
    setFloorsError(null);
    setFloors([]);
    setSlots([]);
    setWizard((p) => ({ ...p, floorId: '', slotId: '' }));
    setDisplaySlotCode('');
    setFetchingFloors(true);
    setStep(2);
    try {
      const data = await getBuildingFloors(token, wizard.buildingId, wizard.vehicleTypeId);
      setFloors(data);
    } catch (err) {
      setFloorsError(err instanceof Error ? err.message : 'Failed to load floors');
    } finally {
      setFetchingFloors(false);
    }
  };

  // Step 2: select floor → fetch slots
  const handleSelectFloor = async (floorId: string) => {
    setWizard((p) => ({ ...p, floorId, slotId: '' }));
    setSlots([]);
    setDisplaySlotCode('');
    setFetchingSlots(true);
    try {
      const data = await getFloorSlots(token, wizard.buildingId, floorId);
      setSlots(data);
    } catch {
      setSlots([]);
    } finally {
      setFetchingSlots(false);
    }
  };

  // Step 2 → Step 3
  const goToStep3 = () => {
    if (!wizard.floorId) {
      Alert.alert('Missing Info', 'Please select a floor.');
      return;
    }
    const floor = floors.find((f) => f._id === wizard.floorId);
    if (floor && !floorHasEntryGate(floor)) {
      Alert.alert('No Gate Available', 'This floor currently has no gate. Please choose another floor.');
      return;
    }
    if (!wizard.slotId) {
      Alert.alert('Missing Info', 'Please select a parking slot.');
      return;
    }
    setCreateError(null);

    // Initialize premium date/time picker
    const now = new Date();
    // Default selected date is today
    let initialDate = now;
    let timeSlotsList = generateTimeSlots(initialDate);
    
    // If no time slots left for today, default to tomorrow
    if (timeSlotsList.length === 0) {
      const tomorrow = new Date();
      tomorrow.setDate(now.getDate() + 1);
      initialDate = tomorrow;
      timeSlotsList = generateTimeSlots(initialDate);
    }
    
    // Set initial time to first available time slot, or default 08:00
    const initialTime = timeSlotsList.length > 0 ? timeSlotsList[0] : '08:00';
    const initialDuration = 2; // Default 2 hours

    setSelDate(initialDate);
    setSelTime(initialTime);
    setSelDuration(initialDuration);

    const [hours, mins] = initialTime.split(':').map(Number);
    const start = new Date(initialDate);
    start.setHours(hours, mins, 0, 0);

    const dStr = start.getFullYear() + '-' + 
      String(start.getMonth() + 1).padStart(2, '0') + '-' + 
      String(start.getDate()).padStart(2, '0');
    const tStr = String(start.getHours()).padStart(2, '0') + ':' + 
      String(start.getMinutes()).padStart(2, '0');
    
    const end = new Date(start);
    end.setHours(end.getHours() + initialDuration);
    const endDStr = end.getFullYear() + '-' + 
      String(end.getMonth() + 1).padStart(2, '0') + '-' + 
      String(end.getDate()).padStart(2, '0');
    const endTStr = String(end.getHours()).padStart(2, '0') + ':' + 
      String(end.getMinutes()).padStart(2, '0');

    setWizard((prev) => ({
      ...prev,
      startTime: `${dStr} ${tStr}`,
      endTime: `${endDStr} ${endTStr}`,
    }));

    setStep(3);
  };

  // Step 3: submit
  const handleCreate = async () => {
    setCreateError(null);
    if (!wizard.startTime.trim()) {
      setCreateError('Please enter a start time.');
      return;
    }
    let startIso: string;
    try {
      startIso = new Date(wizard.startTime.trim()).toISOString();
    } catch {
      setCreateError('Invalid start time. Use format YYYY-MM-DD HH:MM');
      return;
    }
    let endIso: string | undefined;
    if (wizard.endTime.trim()) {
      try {
        endIso = new Date(wizard.endTime.trim()).toISOString();
      } catch {
        setCreateError('Invalid end time. Use format YYYY-MM-DD HH:MM');
        return;
      }
    }
    try {
      setCreating(true);
      const result = await createReservation(token, {
        buildingId: wizard.buildingId,
        vehicleTypeId: wizard.vehicleTypeId,
        plateNumber: wizard.plateNumber.trim().toUpperCase(),
        slotId: wizard.slotId,
        startTime: startIso,
        endTime: endIso,
      });
      closeWizard();
      load();
      const feeTxt = result.fee
        ? ` ${fmtVND(result.fee)} was paid from your wallet.`
        : '';
      Alert.alert('Reservation Confirmed', `Your slot is booked.${feeTxt}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create reservation');
    } finally {
      setCreating(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = reservations.filter((r) =>
    filter === 'booked' ? !isCancelled(r.status) : isCancelled(r.status),
  );
  const selectedFloor = floors.find((f) => f._id === wizard.floorId);
  const selectedBuilding = buildings.find((b) => b._id === wizard.buildingId);

  // Plates filtered to match the selected vehicle type
  const selectedVt = vehicleTypes.find((vt) => vt._id === wizard.vehicleTypeId);
  const vtCategory = selectedVt ? guessVehicleCategory(selectedVt.name) : null;
  const eligiblePlates = vtCategory ? plates.filter((p) => p.vehicleType === vtCategory) : plates;

  const estimatedFee = (() => {
    if (!wizard.startTime.trim() || !wizard.endTime.trim()) return null;
    try {
      const start = new Date(wizard.startTime.trim());
      const end = new Date(wizard.endTime.trim());
      const totalMs = end.getTime() - start.getTime();
      if (totalMs <= 0) return null;
      const hours = Math.floor(totalMs / 3600000);
      const mins = Math.round((totalMs % 3600000) / 60000);
      const duration = hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}m` : ''}` : `${mins}m`;
      return `${duration} · Fee calculated by hourly rate at checkout`;
    } catch {
      return null;
    }
  })();

  // ── Render ─────────────────────────────────────────────────────────────────

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
            <TouchableOpacity
              key={key}
              style={[styles.filterBtn, styles.filterBtnFlex, filter === key && styles.filterBtnActive]}
              onPress={() => setFilter(key)}
            >
              <Text style={[styles.filterText, filter === key && styles.filterTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={32} color={Colors.textDim} />
            <Text style={styles.emptyText}>No reservations found.</Text>
          </View>
        ) : (
          filtered.map((r) => (
            <View key={r._id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.plateTxt}>{r.plateNumber}</Text>
                  {r.building && <Text style={styles.buildingTxt}>{r.building.name}</Text>}
                  {r.slot && (
                    <Text style={styles.slotTxt}>
                      Slot {r.slot.code}
                      {r.slot.floor !== undefined ? ` · Floor ${
                        typeof r.slot.floor === 'object'
                          ? (r.slot.floor.name || r.slot.floor.code || '')
                          : r.slot.floor
                      }` : ''}
                    </Text>
                  )}
                </View>
                <Badge label={statusLabel(r.status)} variant={statusVariant(r.status)} />
              </View>

              <View style={styles.divider} />

              <View style={styles.timeRow}>
                <View>
                  <Text style={styles.timeLabel}>START</Text>
                  <Text style={styles.timeValue}>{fmtDate(r.startTime)}</Text>
                </View>
                {r.endTime && (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.timeLabel}>END</Text>
                    <Text style={styles.timeValue}>{fmtDate(r.endTime)}</Text>
                  </View>
                )}
              </View>

              {((r.gates && r.gates.length > 0) || r.fee) && (
                <View style={styles.metaBox}>
                  {r.gates && r.gates.length > 0 && (
                    <View style={styles.metaItem}>
                      <Ionicons name="enter-outline" size={14} color={Colors.primary} />
                      <Text style={styles.metaText}>
                        Entry gate:{' '}
                        <Text style={styles.metaStrong}>{r.gates.map((g) => g.code).join(', ')}</Text>
                        {r.gates[0].name ? ` · ${r.gates[0].name}` : ''}
                      </Text>
                    </View>
                  )}
                  {r.fee ? (
                    <View style={styles.metaItem}>
                      <Ionicons name="wallet-outline" size={14} color={Colors.textMuted} />
                      <Text style={styles.metaText}>
                        Paid: <Text style={styles.metaStrong}>{fmtVND(r.fee)}</Text>
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}

              {(r.status === 'pending' || r.status === 'confirmed') && (
                <Button
                  label={cancellingId === r._id ? 'Cancelling...' : 'Cancel Reservation'}
                  onPress={() => handleCancel(r)}
                  variant="danger"
                  size="sm"
                  loading={cancellingId === r._id}
                  style={{ alignSelf: 'flex-start', marginTop: Spacing.xs }}
                />
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* ── Wizard Modal ─────────────────────────────────────────────────────── */}
      <Modal visible={showWizard} transparent animationType="slide" onRequestClose={closeWizard}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {/* Step indicator */}
            <View style={styles.stepRow}>
              {[1, 2, 3].map((n, idx) => (
                <React.Fragment key={n}>
                  {idx > 0 && <View style={[styles.stepLine, step >= n && styles.stepLineActive]} />}
                  <View style={[styles.stepDot, step >= n && styles.stepDotActive]}>
                    <Text style={[styles.stepDotText, step >= n && styles.stepDotTextActive]}>{n}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>

            <Text style={styles.modalTitle}>
              {step === 1 ? 'Step 1 — Building & Vehicle'
                : step === 2 ? 'Step 2 — Floor & Slot'
                : 'Step 3 — Time & Confirm'}
            </Text>

            {/* ── STEP 1 ────────────────────────────────────────────────────── */}
            {step === 1 && (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                <View style={{ gap: Spacing.md, paddingBottom: Spacing.lg }}>

                  {/* Building selector */}
                  <View style={{ gap: 6 }}>
                    <Text style={styles.fieldLabel}>Select Building</Text>
                    {fetchingBuildings ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : buildings.length === 0 ? (
                      <Text style={styles.hintText}>No buildings available.</Text>
                    ) : (
                      buildings.map((b) => {
                        const addrStr = typeof b.address === 'string'
                          ? b.address
                          : (b.address as any)?.fullAddress ?? null;
                        return (
                          <TouchableOpacity
                            key={b._id}
                            style={[styles.buildingCard, wizard.buildingId === b._id && styles.buildingCardActive]}
                            onPress={() => handleSelectBuilding(b._id)}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.buildingName, wizard.buildingId === b._id && { color: Colors.primary }]}>
                                {b.name}
                              </Text>
                              {addrStr ? (
                                <Text style={styles.buildingAddr}>{addrStr}</Text>
                              ) : null}
                            </View>
                            <Text style={styles.buildingCode}>{b.code}</Text>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </View>

                  {/* License plate selector — filtered by vehicle type category */}
                  <View style={{ gap: 6 }}>
                    <Text style={styles.fieldLabel}>
                      License Plate
                      {vtCategory ? (
                        <Text style={{ color: Colors.textDim }}>
                          {' '}({vtCategory === 'motorcycle' ? 'Motorcycle only' : 'Car only'})
                        </Text>
                      ) : null}
                    </Text>
                    {eligiblePlates.length > 0 ? (
                      <View style={styles.chipRow}>
                        {eligiblePlates.map((p) => {
                          const isCar = p.vehicleType === 'car';
                          const emoji = isCar ? '🚗' : '🏍️';
                          return (
                            <TouchableOpacity
                              key={p.plateNumber}
                              style={[styles.chip, wizard.plateNumber === p.plateNumber && styles.chipActive]}
                              onPress={() => setWizard((prev) => ({ ...prev, plateNumber: p.plateNumber }))}
                            >
                              <Text style={[styles.chipText, wizard.plateNumber === p.plateNumber && styles.chipTextActive]}>
                                {emoji} {p.plateNumber}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ) : vtCategory && plates.length > 0 ? (
                      <View style={styles.errorBox}>
                        <Text style={styles.errorText}>
                          You have no {vtCategory === 'motorcycle' ? 'motorcycle' : 'car'} plates saved. Add one in Profile first.
                        </Text>
                      </View>
                    ) : (
                      <TextInput
                        value={wizard.plateNumber}
                        onChangeText={(t) => setWizard((p) => ({ ...p, plateNumber: t.toUpperCase() }))}
                        placeholder="e.g. 29A-12345"
                        placeholderTextColor={Colors.textDim}
                        style={styles.textInput}
                        autoCapitalize="characters"
                      />
                    )}
                  </View>

                  {/* Vehicle type selector */}
                  <View style={{ gap: 6 }}>
                    <Text style={styles.fieldLabel}>
                      Vehicle Type
                      {fetchingVT ? <Text style={{ color: Colors.textDim }}> (loading...)</Text> : null}
                    </Text>
                    {fetchingVT ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : vehicleTypes.length > 0 ? (
                      <View style={styles.chipRow}>
                        {vehicleTypes.map((vt) => (
                          <TouchableOpacity
                            key={vt._id}
                            style={[styles.chip, wizard.vehicleTypeId === vt._id && styles.chipActive]}
                            onPress={() => {
                              const cat = guessVehicleCategory(vt.name);
                              const matchPlate = cat ? plates.find((p) => p.vehicleType === cat) : plates[0];
                              setWizard((prev) => ({
                                ...prev,
                                vehicleTypeId: vt._id,
                                plateNumber: matchPlate?.plateNumber ?? '',
                              }));
                            }}
                          >
                            <Text style={[styles.chipText, wizard.vehicleTypeId === vt._id && styles.chipTextActive]}>
                              {vt.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : wizard.buildingId ? (
                      <Text style={styles.hintText}>No vehicle types for this building.</Text>
                    ) : (
                      <Text style={styles.hintText}>Select a building to load vehicle types.</Text>
                    )}
                  </View>
                </View>
              </ScrollView>
            )}

            {/* ── STEP 2 ────────────────────────────────────────────────────── */}
            {step === 2 && (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                <View style={{ gap: Spacing.lg, paddingBottom: Spacing.lg }}>

                  <View style={{ gap: 8 }}>
                    <Text style={styles.fieldLabel}>Select Floor</Text>
                    {fetchingFloors ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : floorsError ? (
                      <Text style={[styles.hintText, { color: Colors.error }]}>{floorsError}</Text>
                    ) : floors.length === 0 ? (
                      <Text style={styles.hintText}>No floors available.</Text>
                    ) : (
                      floors.map((floor) => (
                        <TouchableOpacity
                          key={floor._id}
                          style={[styles.floorCard, wizard.floorId === floor._id && styles.floorCardActive]}
                          onPress={() => handleSelectFloor(floor._id)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.floorName, wizard.floorId === floor._id && { color: Colors.primary }]}>
                              {floor.name || floor.code} {floor.levelNumber ? `(L${floor.levelNumber})` : ''}
                            </Text>
                            <Text style={styles.floorSub}>
                              {floor.availableSlots}/{floor.totalSlots} slots available
                            </Text>
                            {floorHasEntryGate(floor) ? (
                              <Text style={styles.floorGateHint}>
                                Gate{floor.gates.length > 1 ? 's' : ''}: {floor.gates.map((g) => g.code).join(', ')}
                              </Text>
                            ) : (
                              <Text style={styles.floorNoGateHint}>No gate available yet</Text>
                            )}
                          </View>
                          <View style={[
                            styles.availBadge,
                            floor.availableSlots === 0 ? styles.availBadgeFull : styles.availBadgeOpen,
                          ]}>
                            <Text style={[
                              styles.availBadgeText,
                              floor.availableSlots === 0 ? { color: Colors.error } : { color: '#16a34a' },
                            ]}>
                              {floor.availableSlots === 0 ? 'Full' : `${floor.availableSlots} free`}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>

                  {/* Gate info panel for selected floor */}
                  {wizard.floorId && selectedFloor && floorHasEntryGate(selectedFloor) && (
                    <View style={styles.gateInfoBox}>
                      <Ionicons name="git-branch-outline" size={14} color={Colors.primary} style={{ marginTop: 1 }} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.gateInfoTitle}>Gate Information</Text>
                        {selectedFloor.gates.map((g: FloorGate) => (
                          <Text key={g._id} style={styles.gateInfoRow}>
                            <Text style={{ fontWeight: '800', fontFamily: 'monospace' }}>{g.code}</Text>
                            {g.name ? ` — ${g.name}` : ''}
                            {' · '}
                            <Text style={{ color: Colors.textDim }}>
                              {g.direction === 'in' ? 'Entry' : g.direction === 'out' ? 'Exit' : 'Entry & Exit'}
                            </Text>
                          </Text>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Floor has no entry gate → block booking with a clear message */}
                  {wizard.floorId && selectedFloor && !floorHasEntryGate(selectedFloor) && (
                    <View style={styles.errorBox}>
                      <Ionicons name="alert-circle" size={16} color={Colors.error} style={{ marginRight: 6 }} />
                      <Text style={styles.errorText}>
                        This floor currently has no gate. Please choose another floor.
                      </Text>
                    </View>
                  )}

                  {wizard.floorId && selectedFloor && floorHasEntryGate(selectedFloor) ? (
                    <View style={{ gap: Spacing.md }}>
                      <Text style={styles.fieldLabel}>Select Parking Slot</Text>
                      
                      {wizard.slotId ? (
                        <View style={styles.selectedSlotConfirmBox}>
                          <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                          <Text style={styles.selectedSlotConfirmText}>
                            Selected Slot: <Text style={{ fontWeight: '900', color: Colors.primary }}>{displaySlotCode || slots.find((s) => s._id === wizard.slotId)?.code}</Text>
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.selectSlotPrompt}>Please select a parking slot using the interactive map.</Text>
                      )}

                      <TouchableOpacity
                        style={styles.openMapBtn}
                        onPress={() => setShowMapModal(true)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="map-outline" size={16} color="#fff" />
                        <Text style={styles.openMapBtnText}>🗺️ View Parking Map (2D/3D)</Text>
                      </TouchableOpacity>

                      {/* ── MAP MODAL ────────────────────────────────────────────────── */}
                      <Modal
                        visible={showMapModal}
                        transparent
                        animationType="slide"
                        onRequestClose={() => setShowMapModal(false)}
                      >
                        <View style={styles.mapModalOverlay}>
                          <View style={styles.mapModalSheet}>
                            {/* Header */}
                            <View style={styles.mapModalHeader}>
                              <View>
                                <Text style={styles.mapModalTitle}>Basement Parking Map</Text>
                                <Text style={styles.mapModalSubtitle}>{selectedFloor?.name || 'Floor Map'}</Text>
                              </View>
                              <TouchableOpacity onPress={() => setShowMapModal(false)}>
                                <Ionicons name="close-circle" size={28} color={Colors.textDim} />
                              </TouchableOpacity>
                            </View>

                            {/* View Mode Toggle */}
                            <View style={styles.mapToggleRow}>
                              <Text style={styles.mapSelectHint}>Tap a slot to select</Text>
                              <View style={styles.toggleBtnGroup}>
                                <TouchableOpacity
                                  style={[styles.toggleBtn, viewMode === '2D' && styles.toggleBtnActive]}
                                  onPress={() => setViewMode('2D')}
                                >
                                  <Ionicons name="grid-outline" size={14} color={viewMode === '2D' ? '#fff' : Colors.textMuted} />
                                  <Text style={[styles.toggleBtnText, viewMode === '2D' && { color: '#fff' }]}>2D Grid</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.toggleBtn, viewMode === '3D' && styles.toggleBtnActive]}
                                  onPress={() => setViewMode('3D')}
                                >
                                  <Ionicons name="cube-outline" size={14} color={viewMode === '3D' ? '#fff' : Colors.textMuted} />
                                  <Text style={[styles.toggleBtnText, viewMode === '3D' && { color: '#fff' }]}>3D View</Text>
                                </TouchableOpacity>
                              </View>
                            </View>

                            {/* Map Content */}
                            <View style={styles.mapModalContent}>
                              {fetchingSlots ? (
                                <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 40 }} />
                              ) : slots.length === 0 ? (
                                <Text style={styles.hintText}>No slots available.</Text>
                              ) : (() => {
                                const slotCount = slots.length;
                                let slotWidth = 50;
                                let slotHeight = 35;
                                let gapVal = 8;
                                if (slotCount < 10) {
                                  slotWidth = 80;
                                  slotHeight = 55;
                                  gapVal = 12;
                                } else if (slotCount <= 20) {
                                  slotWidth = 65;
                                  slotHeight = 45;
                                  gapVal = 10;
                                }
                                const fontSize3D = slotWidth < 60 ? 9 : 11;

                                if (viewMode === '2D') {
                                  return (
                                    <ScrollView contentContainerStyle={styles.scroll2DContainer}>
                                      <View style={[styles.slotGrid, { gap: gapVal }]}>
                                        {slots.map((slot) => {
                                          const isAvailable = slot.status === 'available';
                                          const isSelected = displaySlotCode === slot.code || (wizard.slotId === slot._id && !displaySlotCode);
                                          return (
                                            <TouchableOpacity
                                              key={slot._id}
                                              style={[
                                                styles.slotCell,
                                                { width: slotWidth, height: slotHeight },
                                                isSelected && styles.slotCellSelected,
                                                !isAvailable && styles.slotCellDisabled,
                                              ]}
                                              onPress={() => {
                                                if (isAvailable) {
                                                  setWizard((p) => ({ ...p, slotId: slot._id }));
                                                  setDisplaySlotCode(slot.code);
                                                }
                                              }}
                                              disabled={!isAvailable}
                                              activeOpacity={isAvailable ? 0.7 : 1}
                                            >
                                              <Text style={[
                                                styles.slotCode,
                                                isSelected && styles.slotCodeSelected,
                                                !isAvailable && styles.slotCodeDisabled,
                                              ]}>
                                                {slot.code}
                                              </Text>
                                              {!isAvailable && (
                                                <Text style={styles.slotTakenLabel}>Taken</Text>
                                              )}
                                            </TouchableOpacity>
                                          );
                                        })}
                                      </View>
                                    </ScrollView>
                                  );
                                } else {
                                  return (
                                    <ScrollView 
                                      horizontal 
                                      showsHorizontalScrollIndicator={false} 
                                      contentContainerStyle={styles.scroll3DHorizontal}
                                    >
                                      <ScrollView 
                                        showsVerticalScrollIndicator={false}
                                        contentContainerStyle={styles.scroll3DVertical}
                                      >
                                        <View style={styles.basement3DContainer}>
                                          <View style={[
                                            styles.isometricCanvas,
                                            {
                                              transform: [
                                                { perspective: 900 },
                                                { rotateX: '52deg' },
                                                { rotateZ: '-35deg' },
                                                { scale: 0.58 }
                                              ]
                                            }
                                          ]}>
                                            {/* Cột bê tông hầm xe */}
                                            <View style={[styles.basementColumn, { top: 6, left: '50%', marginLeft: -7, opacity: 0.9 }]} />
                                            <View style={[styles.basementColumn, { bottom: 6, left: '50%', marginLeft: -7, opacity: 0.9 }]} />

                                            {/* Bố cục 2 dãy đỗ đối xứng hai bên đường */}
                                            <View style={styles.basementLanesRow}>
                                              
                                              {/* DÃY BÊN TRÁI (Left Parking Lane - Số lẻ) */}
                                              <View style={styles.parkingLane3D}>
                                                {slots.filter((_, idx) => idx % 2 === 0).map((slot) => {
                                                  const isAvailable = slot.status === 'available';
                                                  const isSelected = wizard.slotId === slot._id;
                                                  
                                                  return (
                                                    <TouchableOpacity
                                                      key={slot._id}
                                                      style={[styles.slot3DBoxContainer, { width: slotWidth, height: slotHeight }]}
                                                      onPress={() => {
                                                        if (isAvailable) {
                                                          setWizard((p) => ({ ...p, slotId: slot._id }));
                                                          setDisplaySlotCode(slot.code);
                                                        }
                                                      }}
                                                      disabled={!isAvailable}
                                                      activeOpacity={0.8}
                                                    >
                                                      <View style={[styles.faceTop3D, { top: -gapVal, left: gapVal }, isSelected && styles.faceTopSelected3D, !isAvailable && styles.faceTopDisabled3D]}>
                                                        <Text style={[styles.codeText3D, { fontSize: fontSize3D }]}>{slot.code}</Text>
                                                        {!isAvailable && <Text style={[styles.carSymbol3D, { fontSize: slotWidth < 60 ? 12 : 15 }]}>🚗</Text>}
                                                      </View>
                                                      <View style={[styles.faceLeft3D, { width: gapVal }, isSelected && styles.faceLeftSelected3D, !isAvailable && styles.faceLeftDisabled3D]} />
                                                      <View style={[styles.faceRight3D, { height: gapVal }, isSelected && styles.faceRightSelected3D, !isAvailable && styles.faceRightDisabled3D]} />
                                                    </TouchableOpacity>
                                                  );
                                                })}
                                              </View>

                                              {/* ĐƯỜNG XE CHẠY Ở GIỮA (Driveway Space) */}
                                              <View style={styles.drivewayLine3D}>
                                                <View style={styles.dashedDivider} />
                                              </View>

                                              {/* DÃY BÊN PHẢI (Right Parking Lane - Số chẵn) */}
                                              <View style={styles.parkingLane3D}>
                                                {slots.filter((_, idx) => idx % 2 === 1).map((slot) => {
                                                  const isAvailable = slot.status === 'available';
                                                  const isSelected = wizard.slotId === slot._id;
                                                  
                                                  return (
                                                    <TouchableOpacity
                                                      key={slot._id}
                                                      style={[styles.slot3DBoxContainer, { width: slotWidth, height: slotHeight }]}
                                                      onPress={() => {
                                                        if (isAvailable) {
                                                          setWizard((p) => ({ ...p, slotId: slot._id }));
                                                          setDisplaySlotCode(slot.code);
                                                        }
                                                      }}
                                                      disabled={!isAvailable}
                                                      activeOpacity={0.8}
                                                    >
                                                      <View style={[styles.faceTop3D, { top: -gapVal, left: gapVal }, isSelected && styles.faceTopSelected3D, !isAvailable && styles.faceTopDisabled3D]}>
                                                        <Text style={[styles.codeText3D, { fontSize: fontSize3D }]}>{slot.code}</Text>
                                                        {!isAvailable && <Text style={[styles.carSymbol3D, { fontSize: slotWidth < 60 ? 12 : 15 }]}>🚗</Text>}
                                                      </View>
                                                      <View style={[styles.faceLeft3D, { width: gapVal }, isSelected && styles.faceLeftSelected3D, !isAvailable && styles.faceLeftDisabled3D]} />
                                                      <View style={[styles.faceRight3D, { height: gapVal }, isSelected && styles.faceRightSelected3D, !isAvailable && styles.faceRightDisabled3D]} />
                                                    </TouchableOpacity>
                                                  );
                                                })}
                                              </View>

                                            </View>
                                          </View>
                                        </View>
                                      </ScrollView>
                                    </ScrollView>
                                  );
                                }
                              })()}
                            </View>

                            {/* Footer Actions */}
                            <View style={styles.mapModalFooter}>
                              <View style={styles.footerInfoCol}>
                                <Text style={styles.footerSelectedTitle}>Selected Position</Text>
                                <Text style={styles.footerSelectedValue}>
                                  {wizard.slotId ? (
                                    `Slot ${slots.find((s) => s._id === wizard.slotId)?.code}`
                                  ) : (
                                    'None Selected'
                                  )}
                                </Text>
                              </View>
                              <TouchableOpacity
                                style={[styles.confirmSelectionBtn, !wizard.slotId && styles.confirmSelectionBtnDisabled]}
                                disabled={!wizard.slotId}
                                onPress={() => setShowMapModal(false)}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.confirmSelectionBtnText}>Confirm Selection</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      </Modal>
                    </View>
                  ) : null}
                </View>
              </ScrollView>
            )}

            {/* ── STEP 3 ────────────────────────────────────────────────────── */}
            {step === 3 && (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
                <View style={{ gap: Spacing.md, paddingBottom: Spacing.lg }}>

                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Summary</Text>
                    <Text style={styles.summaryRow}>
                      <Text style={styles.summaryKey}>Building: </Text>
                      {selectedBuilding?.name ?? wizard.buildingId}
                    </Text>
                    <Text style={styles.summaryRow}>
                      <Text style={styles.summaryKey}>Plate: </Text>
                      {wizard.plateNumber}
                      {(() => {
                        const selectedPlate = plates.find((p) => p.plateNumber === wizard.plateNumber);
                        return selectedPlate
                          ? selectedPlate.vehicleType === 'car'
                            ? ' (🚗 Car)'
                            : ' (🏍️ Motorcycle)'
                          : '';
                      })()}
                    </Text>
                    <Text style={styles.summaryRow}>
                      <Text style={styles.summaryKey}>Floor: </Text>
                      {selectedFloor ? `${selectedFloor.name || selectedFloor.code}` : '—'}
                    </Text>
                    <Text style={styles.summaryRow}>
                      <Text style={styles.summaryKey}>Slot: </Text>
                      {displaySlotCode || slots.find((s) => s._id === wizard.slotId)?.code || wizard.slotId}
                    </Text>
                    {selectedFloor?.gates && selectedFloor.gates.length > 0 && (
                      <Text style={styles.summaryRow}>
                        <Text style={styles.summaryKey}>Gate: </Text>
                        {selectedFloor.gates.map((g: FloorGate) => `${g.code}${g.name ? ` (${g.name})` : ''}`).join(' / ')}
                      </Text>
                    )}
                  </View>

                  {/* Date Selector */}
                  <View style={{ gap: Spacing.xs }}>
                    <Text style={styles.fieldLabel}>📅 Select Date</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScrollPadding}>
                      {generateNext7Days().map((d, i) => {
                        const isSelected = selDate.toDateString() === d.toDateString();
                        const dayName = getDayName(d);
                        const dayNum = String(d.getDate()).padStart(2, '0');
                        const monName = getMonthName(d);
                        return (
                          <TouchableOpacity
                            key={i}
                            style={[styles.dateCard, isSelected && styles.dateCardActive]}
                            onPress={() => handleDateChange(d)}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.dateDayText, isSelected && styles.dateTextActive]}>{dayName}</Text>
                            <Text style={[styles.dateNumberText, isSelected && styles.dateTextActive]}>{dayNum}</Text>
                            <Text style={[styles.dateMonthText, isSelected && styles.dateMonthTextActive]}>{monName}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Start Time Selector */}
                  <View style={{ gap: Spacing.xs }}>
                    <Text style={styles.fieldLabel}>⏰ Select Start Time</Text>
                    {generateTimeSlots(selDate).length === 0 ? (
                      <Text style={styles.hintText}>No times available for today. Please select a later date.</Text>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScrollPadding}>
                        {generateTimeSlots(selDate).map((time) => {
                          const isSelected = selTime === time;
                          return (
                            <TouchableOpacity
                              key={time}
                              style={[styles.timeChip, isSelected && styles.timeChipActive]}
                              onPress={() => handleTimeChange(time)}
                              activeOpacity={0.8}
                            >
                              <Text style={[styles.timeChipText, isSelected && styles.timeChipTextActive]}>
                                {time}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    )}
                  </View>

                  {/* Duration Selector */}
                  <View style={{ gap: Spacing.xs }}>
                    <Text style={styles.fieldLabel}>⏳ Select Duration</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScrollPadding}>
                      {([
                        { value: 1, label: '1 hour' },
                        { value: 2, label: '2 hours' },
                        { value: 3, label: '3 hours' },
                        { value: 4, label: '4 hours' },
                        { value: 6, label: '6 hours' },
                        { value: 8, label: '8 hours' },
                        { value: 12, label: '12 hours' },
                        { value: 24, label: '24 hours' },
                        { value: 'flexible', label: 'Flexible (Pay at Checkout)' },
                      ] as { value: number | 'flexible'; label: string }[]).map((dur) => {
                        const isSelected = selDuration === dur.value;
                        return (
                          <TouchableOpacity
                            key={dur.value}
                            style={[styles.durationChip, isSelected && styles.durationChipActive]}
                            onPress={() => handleDurationChange(dur.value)}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.durationChipText, isSelected && styles.durationChipTextActive]}>
                              {dur.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  <View style={styles.timelineSummaryCard}>
                    <View style={styles.timelinePoint}>
                      <Ionicons name="enter-outline" size={16} color="#16a34a" />
                      <View style={{ marginLeft: 8 }}>
                        <Text style={styles.timelineLabel}>Check-in Start Time</Text>
                        <Text style={styles.timelineValueText}>
                          {selDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: '2-digit', year: 'numeric' })} at {selTime}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.timelineConnector} />
                    
                    <View style={styles.timelinePoint}>
                      <Ionicons name="exit-outline" size={16} color={selDuration === 'flexible' ? Colors.primary : Colors.error} />
                      <View style={{ marginLeft: 8 }}>
                        <Text style={styles.timelineLabel}>Check-out Deadline</Text>
                         {selDuration === 'flexible' ? (
                           <Text style={[styles.timelineValueText, { color: Colors.primary, fontWeight: '800' }]}>
                             Flexible — Fee calculated at checkout
                           </Text>
                         ) : (
                           <Text style={styles.timelineValueText}>
                             {(() => {
                               const [hours, mins] = selTime.split(':').map(Number);
                               const start = new Date(selDate);
                               start.setHours(hours, mins, 0, 0);
                               const end = new Date(start);
                               end.setHours(end.getHours() + (selDuration as number));
                               return end.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: '2-digit', year: 'numeric' }) + ' at ' + String(end.getHours()).padStart(2, '0') + ':' + String(end.getMinutes()).padStart(2, '0');
                             })()}
                           </Text>
                         )}
                      </View>
                    </View>
                  </View>

                  {estimatedFee ? (
                    <View style={styles.feeHintBox}>
                      <Ionicons name="cash-outline" size={14} color={Colors.primary} />
                      <Text style={styles.feeHintText}>{estimatedFee}</Text>
                    </View>
                  ) : null}

                  {createError ? (
                    <View style={styles.errorBox}>
                      <Ionicons name="alert-circle" size={16} color={Colors.error} style={{ marginRight: 6 }} />
                      <Text style={styles.errorText}>{createError}</Text>
                    </View>
                  ) : null}
                </View>
              </ScrollView>
            )}

            {/* ── Navigation buttons ─────────────────────────────────────────── */}
            <View style={styles.modalBtns}>
              {step > 1 ? (
                <Button
                  label="← Back"
                  onPress={() => setStep((s) => (s - 1) as WizardStep)}
                  variant="secondary"
                  size="lg"
                  style={{ flex: 1 }}
                />
              ) : (
                <Button label="Close" onPress={closeWizard} variant="secondary" size="lg" style={{ flex: 1 }} />
              )}
              {step === 1 && <Button label="Next →" onPress={goToStep2} size="lg" style={{ flex: 1 }} />}
              {step === 2 && <Button label="Next →" onPress={goToStep3} size="lg" style={{ flex: 1 }} />}
              {step === 3 && (
                <Button label="Book & Pay" onPress={handleCreate} loading={creating} size="lg" style={{ flex: 1 }} />
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: 32,
    gap: Spacing.lg,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageTitle: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.text },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    padding: Spacing.md,
  },
  errorText: { color: Colors.error, fontSize: FontSize.sm, fontWeight: '600', flex: 1 },

  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.full,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnFlex: { flex: 1 },
  filterBtnActive: { backgroundColor: Colors.primary },
  filterText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textMuted },
  filterTextActive: { color: '#fff' },

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
  plateTxt: { fontSize: FontSize.md, fontWeight: '900', color: Colors.text, fontFamily: 'monospace' },
  buildingTxt: { fontSize: FontSize.sm, color: Colors.textMuted },
  slotTxt: { fontSize: FontSize.sm, color: Colors.textDim },
  divider: { height: 1, backgroundColor: Colors.border },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timeLabel: { fontSize: 10, fontWeight: '800', color: Colors.textDim, textTransform: 'uppercase', letterSpacing: 1 },
  timeValue: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted },

  metaBox: {
    gap: 6,
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: FontSize.sm, color: Colors.textMuted, flex: 1 },
  metaStrong: { fontWeight: '800', color: Colors.text, fontFamily: 'monospace' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing['2xl'],
    paddingBottom: 36,
    gap: Spacing.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.border,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: Spacing.xs,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.text },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -Spacing.sm,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.cardAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  stepDotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepDotText: { fontSize: 11, fontWeight: '800', color: Colors.textDim },
  stepDotTextActive: { color: '#fff' },
  stepLine: { height: 2, width: 32, backgroundColor: Colors.border, marginHorizontal: -1 },
  stepLineActive: { backgroundColor: Colors.primary },

  fieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  hintText: { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic' },

  // Building card
  buildingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  buildingCardActive: {
    borderColor: 'rgba(249,115,22,0.5)',
    backgroundColor: 'rgba(249,115,22,0.08)',
  },
  buildingName: { fontSize: FontSize.base, fontWeight: '700', color: Colors.text },
  buildingAddr: { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 2 },
  buildingCode: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.textDim,
    fontFamily: 'monospace',
    backgroundColor: Colors.cardAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.cardAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderColor: 'rgba(249,115,22,0.4)',
  },
  chipText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textMuted, fontFamily: 'monospace' },
  chipTextActive: { color: Colors.primary },

  textInput: {
    backgroundColor: Colors.cardAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    height: 48,
    color: Colors.text,
    fontSize: FontSize.base,
  },

  floorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  floorCardActive: {
    borderColor: 'rgba(249,115,22,0.5)',
    backgroundColor: 'rgba(249,115,22,0.08)',
  },
  floorName: { fontSize: FontSize.base, fontWeight: '700', color: Colors.text },
  floorSub: { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 2 },
  floorGateHint: { fontSize: FontSize.xs, color: Colors.primary, marginTop: 2, fontWeight: '600' },
  floorNoGateHint: { fontSize: FontSize.xs, color: Colors.error, marginTop: 2, fontWeight: '600' },
  availBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  availBadgeOpen: { backgroundColor: 'rgba(22,163,74,0.12)' },
  availBadgeFull: { backgroundColor: 'rgba(239,68,68,0.12)' },
  availBadgeText: { fontSize: 11, fontWeight: '800' },

  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  slotCell: {
    width: 64,
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.45)',
    backgroundColor: 'rgba(249,115,22,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  slotCellSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(249,115,22,0.25)',
  },
  slotCellDisabled: { borderColor: Colors.border, backgroundColor: Colors.cardAlt, opacity: 0.5 },
  slotCode: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.primary, fontFamily: 'monospace' },
  slotCodeSelected: { color: Colors.primary },
  slotCodeDisabled: { color: Colors.textDim },
  slotTakenLabel: { fontSize: 9, fontWeight: '700', color: Colors.textDim, textTransform: 'uppercase' },

  summaryCard: {
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 4,
  },
  summaryTitle: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.textDim, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  summaryRow: { fontSize: FontSize.sm, color: Colors.text },
  summaryKey: { fontWeight: '700', color: Colors.textMuted },

  feeHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(249,115,22,0.08)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.2)',
    padding: Spacing.sm,
  },
  feeHintText: { fontSize: FontSize.xs, color: Colors.primary, flex: 1 },
  gateInfoBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(249,115,22,0.06)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.2)',
    padding: Spacing.md,
  },
  gateInfoTitle: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  gateInfoRow: { fontSize: FontSize.sm, color: Colors.text },
  modalBtns: { flexDirection: 'row', gap: Spacing.sm },

  // ─── 3D Isometric Map Styles ───────────────────────────────────────────────
  openMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.4)',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  openMapBtnText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  selectedSlotConfirmBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(22, 163, 74, 0.08)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.2)',
    padding: Spacing.md,
  },
  selectedSlotConfirmText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  selectSlotPrompt: {
    color: Colors.textDim,
    fontSize: FontSize.xs,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 4,
  },

  // Map Modal Styles
  mapModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)', // Elegant slate dark backdrop
    justifyContent: 'flex-end',
  },
  mapModalSheet: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: '85%', // Tràn màn hình nhưng vẫn thấy lớp nền phía trên
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  mapModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  mapModalTitle: {
    fontSize: FontSize.md,
    fontWeight: '900',
    color: Colors.text,
  },
  mapModalSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  mapToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.cardAlt,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  mapSelectHint: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textDim,
  },
  mapModalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#090d16', // Ultra dark theme inside map canvas
  },
  scroll2DContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapModalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerInfoCol: {
    gap: 4,
  },
  footerSelectedTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  footerSelectedValue: {
    fontSize: FontSize.base,
    fontWeight: '900',
    color: Colors.primary,
  },
  confirmSelectionBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmSelectionBtnDisabled: {
    backgroundColor: Colors.border,
    opacity: 0.5,
  },
  confirmSelectionBtnText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: '800',
  },

  // Concrete Columns 3D
  columnBase: {
    position: 'absolute',
    width: 20,
    height: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 15,
  },
  pillarLeftFace: {
    position: 'absolute',
    left: 0,
    top: -24,
    width: 10,
    height: 24,
    backgroundColor: '#fbbf24',
    overflow: 'hidden',
    borderTopLeftRadius: 1,
    borderBottomLeftRadius: 1,
    zIndex: 16,
  },
  pillarRightFace: {
    position: 'absolute',
    left: 10,
    top: -24,
    width: 10,
    height: 24,
    backgroundColor: '#d97706',
    overflow: 'hidden',
    borderTopRightRadius: 1,
    borderBottomRightRadius: 1,
    zIndex: 16,
  },
  pillarTopFace: {
    position: 'absolute',
    top: -29,
    left: 5,
    width: 20,
    height: 20,
    backgroundColor: '#475569',
    borderWidth: 1,
    borderColor: '#94a3b8',
    zIndex: 17,
  },

  viewModeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  toggleBtnGroup: {
    flexDirection: 'row',
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    gap: 4,
  },
  toggleBtnActive: {
    backgroundColor: Colors.primary,
  },
  toggleBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  scroll3DHorizontal: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  scroll3DVertical: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  basement3DContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 380, // Explicit width to host rotated bounds without clipping
    height: 720, // Explicit height to host rotated bounds without clipping
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  basementColumn: {
    position: 'absolute',
    width: 14,
    height: 40,
    backgroundColor: '#334155', // Slate dark
    borderLeftWidth: 3,
    borderLeftColor: '#fbbf24', // Yellow stripe
    borderRightWidth: 3,
    borderRightColor: '#fbbf24', // Yellow stripe
    borderRadius: 2,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  basementLanesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  isometricCanvas: {
    transform: [
      { perspective: 900 },
      { rotateX: '58deg' },
      { rotateZ: '-38deg' }
    ],
    width: 320,
    padding: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.4)', // Dark premium background
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  slots3DLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  parkingLane3D: {
    flexDirection: 'column',
    gap: 20,
  },
  slot3DBoxContainer: {
    position: 'relative',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 4,
  },
  faceTop3D: {
    position: 'absolute',
    borderRadius: 4,
    borderWidth: 1.5,
    backgroundColor: 'rgba(34, 197, 94, 0.15)', // Glassmorphism green
    borderColor: 'rgba(34, 197, 94, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    width: '100%',
    height: '100%',
  },
  faceTopSelected3D: {
    backgroundColor: 'rgba(249, 115, 22, 0.35)', // Orange neon glow
    borderColor: '#f97316',
    shadowColor: '#f97316',
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  faceTopDisabled3D: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    shadowOpacity: 0,
  },
  faceLeft3D: {
    position: 'absolute',
    left: 0,
    top: 0,
    backgroundColor: 'rgba(34, 197, 94, 0.4)',
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    zIndex: 2,
    height: '100%',
  },
  faceLeftSelected3D: {
    backgroundColor: 'rgba(249, 115, 22, 0.7)',
  },
  faceLeftDisabled3D: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
  },
  faceRight3D: {
    position: 'absolute',
    left: 0,
    top: 0,
    backgroundColor: 'rgba(34, 197, 94, 0.25)',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    zIndex: 1,
    width: '100%',
  },
  faceRightSelected3D: {
    backgroundColor: 'rgba(249, 115, 22, 0.5)',
  },
  faceRightDisabled3D: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  codeText3D: {
    fontSize: 10,
    fontWeight: '900',
    color: '#fff',
    fontFamily: 'monospace',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  carSymbol3D: {
    fontSize: 14,
    marginTop: 2,
  },
  drivewayLine3D: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedDivider: {
    height: '100%',
    width: 2,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },

  // Premium Picker Styles
  horizontalScrollPadding: {
    paddingRight: 20,
  },
  dateCard: {
    backgroundColor: Colors.cardAlt,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 10,
    alignItems: 'center',
    width: 75,
  },
  dateCardActive: {
    borderColor: 'rgba(249,115,22,0.6)',
    backgroundColor: 'rgba(249,115,22,0.1)',
  },
  dateDayText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textDim,
    textTransform: 'uppercase',
  },
  dateNumberText: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.text,
    marginVertical: 2,
  },
  dateMonthText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  dateTextActive: {
    color: Colors.primary,
  },
  dateMonthTextActive: {
    color: 'rgba(249,115,22,0.85)',
  },
  timeChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: Radius.full,
    backgroundColor: Colors.cardAlt,
    borderColor: Colors.border,
    borderWidth: 1,
    marginRight: 8,
  },
  timeChipActive: {
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderColor: Colors.primary,
  },
  timeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    fontFamily: 'monospace',
  },
  timeChipTextActive: {
    color: Colors.primary,
  },
  durationChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: Radius.full,
    backgroundColor: Colors.cardAlt,
    borderColor: Colors.border,
    borderWidth: 1,
    marginRight: 8,
  },
  durationChipActive: {
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderColor: Colors.primary,
  },
  durationChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  durationChipTextActive: {
    color: Colors.primary,
  },
  timelineSummaryCard: {
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginVertical: 4,
  },
  timelinePoint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timelineValueText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  timelineConnector: {
    width: 2,
    height: 16,
    backgroundColor: Colors.border,
    marginLeft: 7,
    marginVertical: 2,
  },
});
