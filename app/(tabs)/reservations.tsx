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
                        {eligiblePlates.map((p) => (
                          <TouchableOpacity
                            key={p.plateNumber}
                            style={[styles.chip, wizard.plateNumber === p.plateNumber && styles.chipActive]}
                            onPress={() => setWizard((prev) => ({ ...prev, plateNumber: p.plateNumber }))}
                          >
                            <Text style={[styles.chipText, wizard.plateNumber === p.plateNumber && styles.chipTextActive]}>
                              {p.plateNumber}
                            </Text>
                          </TouchableOpacity>
                        ))}
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
                    <View style={{ gap: 8 }}>
                      <Text style={styles.fieldLabel}>
                        Select Slot — {selectedFloor?.name || 'Selected Floor'}
                      </Text>
                      {fetchingSlots ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                      ) : slots.length === 0 ? (
                        <Text style={styles.hintText}>No slots available.</Text>
                      ) : (
                        <View style={styles.slotGrid}>
                          {slots.map((slot) => {
                            const isAvailable = slot.status === 'available';
                            const isSelected = wizard.slotId === slot._id;
                            return (
                              <TouchableOpacity
                                key={slot._id}
                                style={[
                                  styles.slotCell,
                                  isSelected && styles.slotCellSelected,
                                  !isAvailable && styles.slotCellDisabled,
                                ]}
                                onPress={() => { if (isAvailable) setWizard((p) => ({ ...p, slotId: slot._id })); }}
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
                      )}
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
                    </Text>
                    <Text style={styles.summaryRow}>
                      <Text style={styles.summaryKey}>Floor: </Text>
                      {selectedFloor ? `${selectedFloor.name || selectedFloor.code}` : '—'}
                    </Text>
                    <Text style={styles.summaryRow}>
                      <Text style={styles.summaryKey}>Slot: </Text>
                      {slots.find((s) => s._id === wizard.slotId)?.code ?? wizard.slotId}
                    </Text>
                    {selectedFloor?.gates && selectedFloor.gates.length > 0 && (
                      <Text style={styles.summaryRow}>
                        <Text style={styles.summaryKey}>Gate: </Text>
                        {selectedFloor.gates.map((g: FloorGate) => `${g.code}${g.name ? ` (${g.name})` : ''}`).join(' / ')}
                      </Text>
                    )}
                  </View>

                  <Input
                    label="Start Time (YYYY-MM-DD HH:MM)"
                    placeholder="e.g. 2025-12-01 09:00"
                    value={wizard.startTime}
                    onChangeText={(t) => setWizard((p) => ({ ...p, startTime: t }))}
                    hint="When do you want to start parking?"
                  />
                  <Input
                    label="End Time (optional)"
                    placeholder="e.g. 2025-12-01 11:00"
                    value={wizard.endTime}
                    onChangeText={(t) => setWizard((p) => ({ ...p, endTime: t }))}
                    hint="Leave blank if unknown — fee calculated at checkout"
                  />

                  {estimatedFee ? (
                    <View style={styles.feeHintBox}>
                      <Ionicons name="time-outline" size={14} color={Colors.primary} />
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
});
