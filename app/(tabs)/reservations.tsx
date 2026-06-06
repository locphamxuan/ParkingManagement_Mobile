import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
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
  estimateFee,
  listBuildings,
  getBuildingVehicleTypes,
  type FeeEstimate,
} from '../../services/reservations';
import type { BuildingOption, VehicleTypeOption } from '../../services/reservations';
import {
  getBuildingFloors,
  getFloorSlots,
} from '../../services/floors';
import type { FloorWithAvailability, SlotItem } from '../../services/floors';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import type { Reservation } from '../../types';
import { DateRangePicker } from '../../components/ui/DateRangePicker';


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

function splitSlotsSymmetrically(allSlots: SlotItem[]) {
  const top: SlotItem[] = [];
  const bottom: SlotItem[] = [];

  const sorted = [...allSlots].sort((a, b) => {
    // Sort naturally: T1, T2, T3...
    const numA = parseInt(a.code.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(b.code.replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });

  sorted.forEach((slot) => {
    const codeUpper = slot.code.toUpperCase();
    if (codeUpper === 'T1' || codeUpper.includes('_') || codeUpper.includes('-')) {
      top.push(slot); // T1 and slots with sub-keys like T2_1 go to top row
    } else if (codeUpper === 'T2') {
      bottom.push(slot); // T2 goes to bottom row
    } else {
      const num = parseInt(slot.code.replace(/\D/g, ''), 10) || 0;
      if (num % 2 === 0) {
        top.push(slot); // Even goes to top row (T4, T6, T8...)
      } else {
        bottom.push(slot); // Odd goes to bottom row (T3, T5, T7...)
      }
    }
  });

  return { topRowSlots: top, bottomRowSlots: bottom };
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

// Format Date → wizard string "YYYY-MM-DD HH:MM"
function toWizardStr(date: Date): string {
  const d = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const t = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `${d} ${t}`;
}


// ─── Custom Inline DateTime Picker ────────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

interface InlineDateTimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  label: string;
  accentColor?: string;
}

function InlineDateTimePicker({ value, onChange, label, accentColor = Colors.primary }: InlineDateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(value.getFullYear());
  const [viewMonth, setViewMonth] = useState(value.getMonth());
  const [selDay, setSelDay] = useState(value.getDate());
  const [selHour, setSelHour] = useState(value.getHours());
  const [selMinute, setSelMinute] = useState(value.getMinutes());

  // Sync internal state when value prop changes externally
  React.useEffect(() => {
    setViewYear(value.getFullYear());
    setViewMonth(value.getMonth());
    setSelDay(value.getDate());
    setSelHour(value.getHours());
    setSelMinute(value.getMinutes());
  }, [value]);

  const commit = (y: number, mo: number, d: number, h: number, mi: number) => {
    const maxDay = getDaysInMonth(y, mo);
    const safeDay = Math.min(d, maxDay);
    onChange(new Date(y, mo, safeDay, h, mi, 0, 0));
  };

  const prevMonth = () => {
    const nm = viewMonth === 0 ? 11 : viewMonth - 1;
    const ny = viewMonth === 0 ? viewYear - 1 : viewYear;
    setViewMonth(nm); setViewYear(ny);
  };
  const nextMonth = () => {
    const nm = viewMonth === 11 ? 0 : viewMonth + 1;
    const ny = viewMonth === 11 ? viewYear + 1 : viewYear;
    setViewMonth(nm); setViewYear(ny);
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  // Build calendar grid (nulls = empty cells before first day)
  const calCells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calCells.push(d);

  const isSelectedDay = (d: number | null) =>
    d !== null && d === selDay && viewYear === value.getFullYear() && viewMonth === value.getMonth();
  const isToday = (d: number | null) => {
    if (d === null) return false;
    const now = new Date();
    return d === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
  };

  const displayStr = value.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  return (
    <View>
      {/* Trigger button */}
      <TouchableOpacity
        style={[dtStyles.trigger, open && { borderColor: accentColor }]}
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.8}
      >
        <View style={[dtStyles.iconCircle, { backgroundColor: `${accentColor}18` }]}>
          <Ionicons name={label === 'CHECK-IN' ? 'enter-outline' : 'exit-outline'} size={18} color={accentColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={dtStyles.triggerLabel}>{label}</Text>
          <Text style={dtStyles.triggerValue}>{displayStr}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textDim} />
      </TouchableOpacity>

      {/* Inline expanded picker */}
      {open && (
        <View style={dtStyles.pickerPanel}>
          {/* ── Month nav ── */}
          <View style={dtStyles.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={dtStyles.navBtn}>
              <Ionicons name="chevron-back" size={18} color={Colors.text} />
            </TouchableOpacity>
            <Text style={dtStyles.monthLabel}>{MONTHS[viewMonth]} {viewYear}</Text>
            <TouchableOpacity onPress={nextMonth} style={dtStyles.navBtn}>
              <Ionicons name="chevron-forward" size={18} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* ── Day-of-week headers ── */}
          <View style={dtStyles.dayHeaderRow}>
            {DAYS_SHORT.map((d) => (
              <Text key={d} style={dtStyles.dayHeader}>{d}</Text>
            ))}
          </View>

          {/* ── Calendar grid — render theo từng hàng 7 ô cố định ── */}
          <View style={dtStyles.calGrid}>
            {Array.from({ length: Math.ceil(calCells.length / 7) }, (_, rowIdx) => (
              <View key={rowIdx} style={dtStyles.calRow}>
                {calCells.slice(rowIdx * 7, rowIdx * 7 + 7).map((day, colIdx) => (
                  <TouchableOpacity
                    key={colIdx}
                    style={[
                      dtStyles.dayCell,
                      isSelectedDay(day) && { backgroundColor: accentColor, borderRadius: 100 },
                      isToday(day) && !isSelectedDay(day) && dtStyles.todayCell,
                    ]}
                    onPress={() => {
                      if (day) {
                        setSelDay(day);
                        commit(viewYear, viewMonth, day, selHour, selMinute);
                      }
                    }}
                    disabled={!day}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      dtStyles.dayCellText,
                      isSelectedDay(day) && { color: '#fff', fontWeight: '800' },
                      isToday(day) && !isSelectedDay(day) && { color: accentColor, fontWeight: '800' },
                    ]}>
                      {day ?? ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>

          {/* ── Divider ── */}
          <View style={dtStyles.divider} />

          {/* ── Time pickers ── */}
          <View style={dtStyles.timeRow}>
            <Text style={dtStyles.timeRowLabel}>Time</Text>
            <View style={dtStyles.timePickersRow}>
              {/* Hour scroll */}
              <View style={dtStyles.scrollColumn}>
                <Text style={dtStyles.scrollColLabel}>HH</Text>
                <ScrollView style={dtStyles.scrollBox} showsVerticalScrollIndicator={false}>
                  {hours.map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={[dtStyles.scrollItem, selHour === h && { backgroundColor: `${accentColor}25`, borderRadius: 8 }]}
                      onPress={() => { setSelHour(h); commit(viewYear, viewMonth, selDay, h, selMinute); }}
                    >
                      <Text style={[dtStyles.scrollItemText, selHour === h && { color: accentColor, fontWeight: '800' }]}>
                        {String(h).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <Text style={dtStyles.timeSep}>:</Text>

              {/* Minute scroll */}
              <View style={dtStyles.scrollColumn}>
                <Text style={dtStyles.scrollColLabel}>MM</Text>
                <ScrollView style={dtStyles.scrollBox} showsVerticalScrollIndicator={false}>
                  {minutes.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[dtStyles.scrollItem, selMinute === m && { backgroundColor: `${accentColor}25`, borderRadius: 8 }]}
                      onPress={() => { setSelMinute(m); commit(viewYear, viewMonth, selDay, selHour, m); }}
                    >
                      <Text style={[dtStyles.scrollItemText, selMinute === m && { color: accentColor, fontWeight: '800' }]}>
                        {String(m).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </View>

          {/* ── Done button ── */}
          <TouchableOpacity
            style={[dtStyles.doneBtn, { backgroundColor: accentColor }]}
            onPress={() => setOpen(false)}
          >
            <Text style={dtStyles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const dtStyles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  triggerLabel: {
    fontSize: FontSize.xs, fontWeight: '800', color: Colors.textDim,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3,
  },
  triggerValue: {
    fontSize: FontSize.sm, fontWeight: '700', color: Colors.text,
  },
  pickerPanel: {
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginTop: 4,
    gap: 8,
  },
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 4, paddingBottom: 4,
  },
  navBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  monthLabel: {
    fontSize: FontSize.base, fontWeight: '800', color: Colors.text,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    paddingBottom: 4,
  },
  dayHeader: {
    flex: 1, textAlign: 'center',
    fontSize: 10, fontWeight: '800', color: Colors.textDim,
    textTransform: 'uppercase',
  },
  calGrid: {
    gap: 2,
  },
  calRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
  },
  dayCellText: {
    fontSize: FontSize.sm, color: Colors.text,
  },
  todayCell: {
    borderRadius: 100, borderWidth: 1.5, borderColor: Colors.primary,
  },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  timeRow: { gap: 6 },
  timeRowLabel: {
    fontSize: 10, fontWeight: '800', color: Colors.textDim,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  timePickersRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
  },
  scrollColumn: { flex: 1, alignItems: 'center', gap: 4 },
  scrollColLabel: {
    fontSize: 9, fontWeight: '900', color: Colors.textDim, letterSpacing: 1,
  },
  scrollBox: {
    height: 120,
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scrollItem: {
    paddingVertical: 6, alignItems: 'center', justifyContent: 'center',
  },
  scrollItemText: {
    fontSize: FontSize.sm, color: Colors.textMuted, fontFamily: 'monospace',
  },
  timeSep: {
    fontSize: 20, fontWeight: '900', color: Colors.textDim,
    marginTop: 28,
  },
  doneBtn: {
    borderRadius: Radius.lg, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  doneBtnText: {
    fontSize: FontSize.sm, fontWeight: '800', color: '#fff',
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ReservationsScreen() {
  const { session } = useAuthStore();
  const token = session?.token ?? '';
  const plates = session?.licensePlates ?? [];

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('booked');

  // Date range state
  const [fromDate, setFromDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  });
  const [toDate, setToDate] = useState<Date | null>(null);


  // Wizard state
  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState<WizardStep>(1);
  const [wizard, setWizard] = useState<WizardState>({ ...EMPTY_WIZARD });
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('2D');
  const [showMapModal, setShowMapModal] = useState(false);
  const [displaySlotCode, setDisplaySlotCode] = useState<string>('');

  // Native date-time pickers
  const [startDateTime, setStartDateTime] = useState<Date>(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  });
  const [endDateTime, setEndDateTime] = useState<Date>(() => {
    const d = new Date(); d.setHours(1, 0, 0, 0); return d;
  });


  const applyDateTime = (target: 'start' | 'end', date: Date) => {
    if (target === 'start') {
      setStartDateTime(date);
      setWizard((prev) => ({ ...prev, startTime: toWizardStr(date) }));
    } else {
      setEndDateTime(date);
      setWizard((prev) => ({ ...prev, endTime: toWizardStr(date) }));
    }
  };

  // Fetch real fee estimate from server whenever step 3 times or vehicle type change.
  useEffect(() => {
    if (step !== 3 || !wizard.buildingId || !wizard.vehicleTypeId || !wizard.startTime || !wizard.endTime) {
      setFeeEstimate(null);
      return;
    }
    let cancelled = false;
    setFetchingFee(true);
    const startISO = new Date(wizard.startTime.trim()).toISOString();
    const endISO = new Date(wizard.endTime.trim()).toISOString();
    estimateFee(token, wizard.buildingId, wizard.vehicleTypeId, startISO, endISO)
      .then((data) => { if (!cancelled) setFeeEstimate(data); })
      .catch(() => { if (!cancelled) setFeeEstimate(null); })
      .finally(() => { if (!cancelled) setFetchingFee(false); });
    return () => { cancelled = true; };
  }, [step, wizard.buildingId, wizard.vehicleTypeId, wizard.startTime, wizard.endTime, token]);

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

  // Step 3 — submit + fee estimate
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [feeEstimate, setFeeEstimate] = useState<FeeEstimate | null>(null);
  const [fetchingFee, setFetchingFee] = useState(false);

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
      await cancelReservation(token, r._id);
      await load();
      Alert.alert(
        'Reservation Cancelled',
        'Your reservation has been cancelled. The deposit is non-refundable and has been forfeited as a cancellation fee.',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not cancel reservation';
      Alert.alert('Error', msg);
    } finally {
      setCancellingId(null);
    }
  };

  const handleCancel = (r: Reservation) => {
    const depositText = r.fee ? ` Deposit of ${fmtVND(r.fee)} will NOT be refunded.` : '';
    const msg = `Cancel reservation for plate "${r.plateNumber}"?\n\nWarning: The deposit is non-refundable.${depositText}`;
    if (Platform.OS === 'web') {
      // biome-ignore lint/suspicious/noExplicitAny: web-only globalThis
      if ((globalThis as any).confirm?.(msg)) doCancel(r);
      return;
    }
    Alert.alert(
      'Cancel Reservation',
      msg,
      [
        { text: 'Keep Reservation', style: 'cancel' },
        { text: 'Cancel & Forfeit Deposit', style: 'destructive', onPress: () => doCancel(r) },
      ],
    );
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
    if (!wizard.slotId) {
      Alert.alert('Missing Info', 'Please select a parking slot.');
      return;
    }
    setCreateError(null);

    const today = new Date();
    const start = new Date(today); start.setHours(0, 0, 0, 0);
    const end = new Date(today); end.setHours(1, 0, 0, 0);

    setStartDateTime(start);
    setEndDateTime(end);
    setWizard((prev) => ({
      ...prev,
      startTime: toWizardStr(start),
      endTime: toWizardStr(end),
    }));

    setStep(3);
  };

  // Step 3: submit
  const handleCreate = async () => {
    setCreateError(null);
    if (!wizard.startTime.trim()) {
      setCreateError('Please select a start time.');
      return;
    }
    if (!wizard.endTime.trim()) {
      setCreateError('Please select a checkout time.');
      return;
    }
    let startIso: string;
    let endIso: string;
    try {
      startIso = new Date(wizard.startTime.trim()).toISOString();
      endIso = new Date(wizard.endTime.trim()).toISOString();
    } catch {
      setCreateError('Invalid time format. Please re-select dates.');
      return;
    }
    if (new Date(endIso) <= new Date(startIso)) {
      setCreateError('Checkout time must be after check-in time.');
      return;
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
      const depositTxt = result.depositAmount
        ? `\nDeposit paid: ${fmtVND(result.depositAmount)} (15%)\nRemaining at checkout: ${fmtVND((result.estimatedFee ?? 0) - (result.depositAmount ?? 0))}`
        : '';
      Alert.alert('Reservation Confirmed', `Your slot is booked.${depositTxt}`);
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

  const finalFiltered = (() => {
    const end = toDate ?? new Date();
    const startOfDay = new Date(fromDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(end);
    endOfDay.setHours(23, 59, 59, 999);
    return filtered.filter((r) => {
      const d = new Date(r.startTime);
      return d >= startOfDay && d <= endOfDay;
    });
  })();

  const selectedFloor = floors.find((f) => f._id === wizard.floorId);
  const selectedBuilding = buildings.find((b) => b._id === wizard.buildingId);


  // Plates filtered to match the selected vehicle type
  const selectedVt = vehicleTypes.find((vt) => vt._id === wizard.vehicleTypeId);
  const vtCategory = selectedVt ? guessVehicleCategory(selectedVt.name) : null;
  const eligiblePlates = vtCategory ? plates.filter((p) => p.vehicleType === vtCategory) : plates;

  // Fee display built from server estimate
  const estimatedFeeInfo = (() => {
    const totalMs = endDateTime.getTime() - startDateTime.getTime();
    if (totalMs <= 0) return null;
    const hours2 = Math.floor(totalMs / 3600000);
    const mins = Math.round((totalMs % 3600000) / 60000);
    const duration = hours2 > 0 ? `${hours2}h${mins > 0 ? ` ${mins}m` : ''}` : `${mins}m`;
    if (fetchingFee) return { duration, depositText: 'Calculating...', remainingText: '' };
    if (!feeEstimate) return { duration, depositText: '—', remainingText: '' };
    // When the stay spans peak hours, show the regular + peak split; else a flat rate.
    const rate = (feeEstimate.peakHours && feeEstimate.peakHours > 0)
      ? `${feeEstimate.regularHours}h × ${fmtVND(feeEstimate.hourlyRate)} + ${feeEstimate.peakHours}h × ${fmtVND(feeEstimate.peakRate ?? 0)} (peak)`
      : `${fmtVND(feeEstimate.hourlyRate)}/hr`;
    return {
      duration,
      depositText: `Deposit now (15%): ${fmtVND(feeEstimate.depositAmount)}`,
      remainingText: `Remaining at checkout: ${fmtVND(feeEstimate.remainingFee)}`,
      rate,
    };
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
          finalFiltered.map((r) => (

            <View key={r._id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.plateTxt}>{r.plateNumber}</Text>
                  {r.building && <Text style={styles.buildingTxt}>{r.building.name}</Text>}
                  {r.slot && (
                    <Text style={styles.slotTxt}>
                      Slot {r.slot.code}
                      {r.slot.floor !== undefined ? ` · Floor ${typeof r.slot.floor === 'object'
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

              {r.fee ? (
                <View style={styles.metaBox}>
                  <View style={styles.metaItem}>
                    <Ionicons name="wallet-outline" size={14} color={Colors.textMuted} />
                    <Text style={styles.metaText}>
                      Deposit paid: <Text style={styles.metaStrong}>{fmtVND(r.fee)}</Text>
                    </Text>
                  </View>
                </View>
              ) : null}

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
                              {floor.code}
                            </Text>
                            <Text style={styles.floorSub}>
                              {floor.availableSlots}/{floor.totalSlots} slots available
                            </Text>
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

                  {wizard.floorId && selectedFloor ? (
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

                            {/* Legend row */}
                            <View style={styles.legendRow2D}>
                              <View style={styles.legendItem2D}>
                                <View style={[styles.legendDot2D, { borderColor: 'rgba(16, 185, 129, 0.5)', backgroundColor: 'rgba(16, 185, 129, 0.1)' }]} />
                                <Text style={styles.legendText2D}>Trống</Text>
                              </View>
                              <View style={styles.legendItem2D}>
                                <View style={[styles.legendDot2D, { borderColor: '#475569', backgroundColor: 'rgba(71, 85, 105, 0.1)' }]} />
                                <Text style={styles.legendText2D}>Đã giữ</Text>
                              </View>
                              <View style={styles.legendItem2D}>
                                <View style={[styles.legendDot2D, { borderColor: 'rgba(255,255,255,0.25)', borderStyle: 'dashed', backgroundColor: 'transparent' }]} />
                                <Text style={styles.legendText2D}>Không khả dụng</Text>
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

                                const { topRowSlots, bottomRowSlots } = splitSlotsSymmetrically(slots);
                                const getSlotSymbol = (sItem: SlotItem) => {
                                  if (sItem.vehicleType?.name) {
                                    const cat = guessVehicleCategory(sItem.vehicleType.name);
                                    if (cat === 'motorcycle') return '🏍️';
                                    return '🚗';
                                  }
                                  const selectedVt = vehicleTypes.find(vt => vt._id === wizard.vehicleTypeId);
                                  if (selectedVt) {
                                    const cat = guessVehicleCategory(selectedVt.name);
                                    if (cat === 'motorcycle') return '🏍️';
                                  }
                                  return '🚗';
                                };

                                if (viewMode === '2D') {
                                  return (
                                    <ScrollView
                                      horizontal
                                      showsHorizontalScrollIndicator={false}
                                      contentContainerStyle={styles.scroll2DHorizontal}
                                    >
                                      <ScrollView
                                        showsVerticalScrollIndicator={false}
                                        contentContainerStyle={styles.scroll2DVertical}
                                      >
                                        <View style={styles.basement2DContainer}>
                                          {/* DÃY T (TOP ROW) */}
                                          <View style={styles.rowHeaderRow2D}>
                                            <Text style={styles.rowHeader2D}>DÃY T (TOP ROW)</Text>
                                          </View>
                                          <View style={styles.parkingLane2D}>
                                            {topRowSlots.map((slot) => {
                                              const isAvailable = slot.status === 'available';
                                              const isSelected = wizard.slotId === slot._id;
                                              return (
                                                <TouchableOpacity
                                                  key={slot._id}
                                                  style={[
                                                    styles.slotCell2D,
                                                    { width: slotWidth + 12, height: slotHeight + 12 },
                                                    isSelected && styles.slotCell2DSelected,
                                                    !isAvailable && styles.slotCell2DDisabled,
                                                  ]}
                                                  onPress={() => {
                                                    if (isAvailable) {
                                                      setWizard((p) => ({ ...p, slotId: slot._id }));
                                                      setDisplaySlotCode(slot.code);
                                                    }
                                                  }}
                                                  disabled={!isAvailable}
                                                  activeOpacity={0.8}
                                                >
                                                  {isAvailable ? (
                                                    <Text style={[styles.slotCode2D, isSelected && styles.slotCode2DSelected]}>
                                                      {slot.code}
                                                    </Text>
                                                  ) : (
                                                    <View style={styles.slotOccupiedContainer2D}>
                                                      <Text style={styles.slotCode2DDisabledTop}>
                                                        {slot.code}
                                                      </Text>
                                                      <Text style={styles.slotVehicleEmoji2D}>
                                                        {getSlotSymbol(slot)}
                                                      </Text>
                                                    </View>
                                                  )}
                                                </TouchableOpacity>
                                              );
                                            })}
                                          </View>

                                          {/* LÀN ĐƯỜNG XE CHẠY Ở GIỮA */}
                                          <View style={styles.drivewayLine2D}>
                                            <Text style={styles.drivewayArrow2D}>◀── LỐI VÀO (IN)</Text>
                                            <View style={styles.dashedDivider2D} />
                                            <Text style={styles.drivewayText2D}>ĐƯỜNG DI CHUYỂN</Text>
                                            <View style={styles.dashedDivider2D} />
                                            <Text style={styles.drivewayArrow2D}>LỐI RA (OUT) ──▶</Text>
                                          </View>

                                          {/* DÃY T (BOTTOM ROW) */}
                                          <View style={styles.rowHeaderRow2D}>
                                            <Text style={styles.rowHeader2D}>DÃY T (BOTTOM ROW)</Text>
                                          </View>
                                          <View style={styles.parkingLane2D}>
                                            {bottomRowSlots.map((slot) => {
                                              const isAvailable = slot.status === 'available';
                                              const isSelected = wizard.slotId === slot._id;
                                              return (
                                                <TouchableOpacity
                                                  key={slot._id}
                                                  style={[
                                                    styles.slotCell2D,
                                                    { width: slotWidth + 12, height: slotHeight + 12 },
                                                    isSelected && styles.slotCell2DSelected,
                                                    !isAvailable && styles.slotCell2DDisabled,
                                                  ]}
                                                  onPress={() => {
                                                    if (isAvailable) {
                                                      setWizard((p) => ({ ...p, slotId: slot._id }));
                                                      setDisplaySlotCode(slot.code);
                                                    }
                                                  }}
                                                  disabled={!isAvailable}
                                                  activeOpacity={0.8}
                                                >
                                                  {isAvailable ? (
                                                    <Text style={[styles.slotCode2D, isSelected && styles.slotCode2DSelected]}>
                                                      {slot.code}
                                                    </Text>
                                                  ) : (
                                                    <View style={styles.slotOccupiedContainer2D}>
                                                      <Text style={styles.slotCode2DDisabledTop}>
                                                        {slot.code}
                                                      </Text>
                                                      <Text style={styles.slotVehicleEmoji2D}>
                                                        {getSlotSymbol(slot)}
                                                      </Text>
                                                    </View>
                                                  )}
                                                </TouchableOpacity>
                                              );
                                            })}
                                          </View>
                                        </View>
                                      </ScrollView>
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

                                              {/* DÃY BÊN TRÁI (Left Parking Lane - Bottom Row) */}
                                              <View style={styles.parkingLane3D}>
                                                {bottomRowSlots.map((slot) => {
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
                                                        {!isAvailable && <Text style={[styles.carSymbol3D, { fontSize: slotWidth < 60 ? 12 : 15 }]}>{getSlotSymbol(slot)}</Text>}
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

                                              {/* DÃY BÊN PHẢI (Right Parking Lane - Top Row) */}
                                              <View style={styles.parkingLane3D}>
                                                {topRowSlots.map((slot) => {
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
                                                        {!isAvailable && <Text style={[styles.carSymbol3D, { fontSize: slotWidth < 60 ? 12 : 15 }]}>{getSlotSymbol(slot)}</Text>}
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
              <ScrollView showsVerticalScrollIndicator={false} style={styles.wizardScrollView}>
                <View style={{ gap: Spacing.md, paddingBottom: Spacing.lg }}>

                  <View style={styles.newSummaryCard}>
                    <View style={styles.summaryHeader}>
                      <Ionicons name="receipt-outline" size={16} color={Colors.primary} />
                      <Text style={styles.newSummaryTitle}>Reservation Summary</Text>
                    </View>

                    <View style={styles.summaryGrid}>
                      <View style={styles.summaryItem}>
                        <View style={styles.summaryIconBox}>
                          <Ionicons name="business-outline" size={16} color={Colors.textDim} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.summaryItemLabel}>BUILDING</Text>
                          <Text style={styles.summaryItemValue} numberOfLines={1}>
                            {selectedBuilding?.name ?? wizard.buildingId}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.summaryItem}>
                        <View style={styles.summaryIconBox}>
                          <Ionicons name="car-outline" size={16} color={Colors.textDim} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.summaryItemLabel}>VEHICLE & PLATE</Text>
                          <Text style={styles.summaryItemValue} numberOfLines={1}>
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
                        </View>
                      </View>

                      <View style={styles.summaryItem}>
                        <View style={styles.summaryIconBox}>
                          <Ionicons name="location-outline" size={16} color={Colors.textDim} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.summaryItemLabel}>PARKING SPOT</Text>
                          <Text style={styles.summaryItemValue}>
                            Floor {selectedFloor ? `${selectedFloor.name || selectedFloor.code}` : '—'} · Slot {displaySlotCode || slots.find((s) => s._id === wizard.slotId)?.code || wizard.slotId}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <InlineDateTimePicker
                    value={startDateTime}
                    onChange={(date) => applyDateTime('start', date)}
                    label="CHECK-IN"
                    accentColor="#16a34a"
                  />

                  <InlineDateTimePicker
                    value={endDateTime}
                    onChange={(date) => applyDateTime('end', date)}
                    label="CHECK-OUT"
                    accentColor={Colors.error}
                  />

                  {estimatedFeeInfo ? (
                    <View style={styles.billingCard}>
                      <View style={styles.billingHeader}>
                        <Ionicons name="wallet-outline" size={16} color={Colors.primary} />
                        <Text style={styles.billingTitle}>Fee Estimation</Text>
                      </View>

                      <View style={styles.billingRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="time-outline" size={14} color={Colors.textDim} />
                          <Text style={styles.billingLabel}>Duration</Text>
                        </View>
                        <Text style={styles.billingValue}>{estimatedFeeInfo.duration}</Text>
                      </View>

                      {'rate' in estimatedFeeInfo && estimatedFeeInfo.rate ? (
                        <View style={styles.billingRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="calculator-outline" size={14} color={Colors.textDim} />
                            <Text style={styles.billingLabel}>Rate Applied</Text>
                          </View>
                          <Text style={[styles.billingValue, { fontSize: FontSize.xs, textAlign: 'right', flex: 1 }]} numberOfLines={2}>
                            {estimatedFeeInfo.rate}
                          </Text>
                        </View>
                      ) : null}

                      <View style={styles.billingDivider} />

                      {fetchingFee ? (
                        <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 8 }} />
                      ) : (
                        <>
                          <View style={[styles.billingRow, styles.depositRow]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Ionicons name="wallet" size={15} color="#f59e0b" />
                              <Text style={[styles.billingLabel, { color: '#f59e0b', fontWeight: '800' }]}>Deposit Now (15%)</Text>
                            </View>
                            <Text style={[styles.billingValue, { color: '#f59e0b', fontWeight: '900', fontSize: FontSize.md }]}>
                              {feeEstimate ? fmtVND(feeEstimate.depositAmount) : '—'}
                            </Text>
                          </View>

                          {feeEstimate && (
                            <View style={styles.billingRow}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="checkmark-circle-outline" size={14} color="#10b981" />
                                <Text style={styles.billingLabel}>Remaining at Checkout</Text>
                              </View>
                              <Text style={[styles.billingValue, { color: '#10b981', fontWeight: '700' }]}>
                                {fmtVND(feeEstimate.remainingFee)}
                              </Text>
                            </View>
                          )}
                        </>
                      )}
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
    maxHeight: '90%',
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
    backgroundColor: 'rgba(71, 85, 105, 0.1)', // Slate sẫm mờ
    borderColor: '#475569',
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
    backgroundColor: 'rgba(71, 85, 105, 0.3)',
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
    backgroundColor: 'rgba(71, 85, 105, 0.2)',
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
  // iOS picker modal
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  pickerSheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  // Premium 2D Layout Styles
  scroll2DHorizontal: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll2DVertical: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  basement2DContainer: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  rowHeaderRow2D: {
    width: '100%',
    alignItems: 'flex-start',
    marginBottom: 6,
    paddingLeft: 4,
  },
  rowHeader2D: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  parkingLane2D: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
  },
  slotCell2D: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.5)', // border-emerald-500/50
    backgroundColor: 'rgba(16, 185, 129, 0.1)', // bg-emerald-500/10
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
  },
  slotCell2DSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  slotCell2DDisabled: {
    borderColor: '#475569', // Slate sẫm mờ border
    backgroundColor: 'rgba(71, 85, 105, 0.1)', // Slate sẫm mờ bg
    shadowOpacity: 0,
  },
  slotCode2D: {
    fontSize: 11,
    fontWeight: '900',
    color: '#10b981',
    fontFamily: 'monospace',
  },
  slotCode2DSelected: {
    color: Colors.primary,
  },
  slotCode2DDisabledTop: {
    fontSize: 8,
    fontWeight: '800',
    color: Colors.textDim,
    fontFamily: 'monospace',
    position: 'absolute',
    top: 4,
  },
  slotVehicleEmoji2D: {
    fontSize: 14,
    marginTop: 10,
  },
  slotOccupiedContainer2D: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  drivewayLine2D: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
  },
  drivewayArrow2D: {
    fontSize: 8,
    fontWeight: '900',
    color: Colors.primary,
    fontFamily: 'monospace',
    letterSpacing: 0.8,
  },
  drivewayText2D: {
    fontSize: 9,
    fontWeight: '900',
    color: Colors.textMuted,
    letterSpacing: 1.5,
  },
  dashedDivider2D: {
    width: 1,
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },

  // Legend Styles
  legendRow2D: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 12,
    backgroundColor: Colors.cardAlt,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  legendItem2D: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot2D: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  legendText2D: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textMuted,
  },

  // Step 3 Redesign Styles
  newSummaryCard: {
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newSummaryTitle: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.text,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  summaryGrid: {
    gap: Spacing.md,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryIconBox: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryItemLabel: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  summaryItemValue: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 1,
  },

  // Billing estimation card
  billingCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  billingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  billingTitle: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.text,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  billingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.md,
  },
  billingLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  billingValue: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  billingDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 2,
  },
  depositRow: {
    backgroundColor: 'rgba(245,158,11,0.04)',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.1)',
  },
  wizardScrollView: {
    maxHeight: 380,
    flexShrink: 1,
  },
});