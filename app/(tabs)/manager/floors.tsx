import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../store/authStore';
import {
  getManagerBuildings,
  getFloors,
  createFloor as createFloorApi,
  updateFloor as updateFloorApi,
  deleteFloor as deleteFloorApi,
  getSlots,
  updateSlotStatus,
  type ManagerBuilding,
  type ManagerFloor,
  type FloorInput,
  type ParkingSlot,
  type SlotStatus,
} from '../../../services/manager';
import { Colors, FontSize, Radius, Spacing } from '../../../constants/theme';

// ─── Constants ──────────────────────────────────────────────────────────────

const SLOT_STATUS_LABEL: Record<SlotStatus, string> = {
  available: 'Available',
  occupied: 'Occupied',
  reserved: 'Reserved',
  maintenance: 'Maintenance',
};

const SLOT_STATUS_COLOR: Record<SlotStatus, string> = {
  available: Colors.success,
  occupied: Colors.primary,
  reserved: Colors.amber,
  maintenance: Colors.error,
};

const SLOT_STATUS_BG: Record<SlotStatus, string> = {
  available: Colors.successBg,
  occupied: `${Colors.primary}14`,
  reserved: Colors.warningBg,
  maintenance: Colors.errorBg,
};

type FloorStatus = 'active' | 'inactive' | 'maintenance';

const FLOOR_STATUS_OPTIONS: FloorStatus[] = ['active', 'inactive', 'maintenance'];

const FLOOR_STATUS_LABEL: Record<FloorStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  maintenance: 'Maintenance',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pickColor(record: Record<SlotStatus, string>, status: SlotStatus | undefined): string {
  return status ? (record[status] ?? Colors.textMuted) : Colors.textMuted;
}

// ─── Floor Form Modal ─────────────────────────────────────────────────────────

interface FloorFormModalProps {
  visible: boolean;
  mode: 'create' | 'edit';
  initial?: ManagerFloor | null;
  saving: boolean;
  onSubmit: (input: FloorInput) => void;
  onCancel: () => void;
}

function FloorFormModal({
  visible,
  mode,
  initial,
  saving,
  onSubmit,
  onCancel,
}: FloorFormModalProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [levelNumber, setLevelNumber] = useState('0');
  const [capacity, setCapacity] = useState('0');
  const [status, setStatus] = useState<FloorStatus>('active');

  useEffect(() => {
    if (!visible) return;
    if (mode === 'edit' && initial) {
      setCode(initial.code ?? '');
      setName(initial.name ?? '');
      setLevelNumber(String(initial.levelNumber ?? 0));
      setCapacity(String(initial.capacity ?? 0));
      setStatus((initial.status as FloorStatus) ?? 'active');
    } else {
      setCode('');
      setName('');
      setLevelNumber('0');
      setCapacity('0');
      setStatus('active');
    }
  }, [visible, mode, initial]);

  const handleSubmit = () => {
    const trimCode = code.trim().toUpperCase();
    const trimName = name.trim();
    if (!trimCode) {
      Alert.alert('Validation', 'Floor code is required.');
      return;
    }
    if (!trimName) {
      Alert.alert('Validation', 'Floor name is required.');
      return;
    }
    const lvl = parseInt(levelNumber, 10);
    if (isNaN(lvl)) {
      Alert.alert('Validation', 'Level number must be a valid integer.');
      return;
    }
    const cap = parseInt(capacity, 10);
    if (isNaN(cap) || cap < 0) {
      Alert.alert('Validation', 'Capacity must be a non-negative integer.');
      return;
    }
    onSubmit({ code: trimCode, name: trimName, levelNumber: lvl, capacity: cap, status });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.modalOverlay} onPress={onCancel}>
        <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHandle} />

          <Text style={styles.modalTitle}>
            {mode === 'create' ? 'Add Floor' : 'Edit Floor'}
          </Text>

          {/* Code */}
          <Text style={styles.inputLabel}>Floor Code *</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="e.g. B1, G, L1"
            placeholderTextColor={Colors.textDim}
            autoCapitalize="characters"
            maxLength={20}
            editable={!saving}
          />

          {/* Name */}
          <Text style={styles.inputLabel}>Floor Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Basement 1, Ground Floor"
            placeholderTextColor={Colors.textDim}
            maxLength={100}
            editable={!saving}
          />

          {/* Level Number */}
          <Text style={styles.inputLabel}>Level Number *</Text>
          <TextInput
            style={styles.input}
            value={levelNumber}
            onChangeText={setLevelNumber}
            placeholder="e.g. -1 for basement, 0 for ground"
            placeholderTextColor={Colors.textDim}
            keyboardType="numbers-and-punctuation"
            editable={!saving}
          />

          {/* Capacity */}
          <Text style={styles.inputLabel}>Slot Capacity *</Text>
          <TextInput
            style={styles.input}
            value={capacity}
            onChangeText={(t) => setCapacity(t.replace(/[^0-9]/g, ''))}
            placeholder="e.g. 50"
            placeholderTextColor={Colors.textDim}
            keyboardType="number-pad"
            editable={!saving}
          />

          {/* Status */}
          <Text style={styles.inputLabel}>Status</Text>
          <View style={styles.statusRow}>
            {FLOOR_STATUS_OPTIONS.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.statusChip, status === s && styles.statusChipSelected]}
                onPress={() => setStatus(s)}
                disabled={saving}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.statusChipLabel,
                    status === s && styles.statusChipLabelSelected,
                  ]}
                >
                  {FLOOR_STATUS_LABEL[s]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              disabled={saving}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnLabel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnLabel}>
                  {mode === 'create' ? 'Create' : 'Save'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Delete Floor Confirmation Modal ─────────────────────────────────────────

interface DeleteFloorModalProps {
  visible: boolean;
  floor: ManagerFloor | null;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteFloorModal({
  visible,
  floor,
  deleting,
  onConfirm,
  onCancel,
}: DeleteFloorModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.modalOverlay} onPress={onCancel}>
        <Pressable
          style={[styles.modalSheet, styles.deleteModalSheet]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.deleteIconWrapper}>
            <Ionicons name="trash-outline" size={32} color={Colors.error} />
          </View>

          <Text style={styles.modalTitle}>Delete Floor</Text>

          <Text style={styles.deleteMessage}>
            Are you sure you want to delete floor{' '}
            <Text style={styles.deleteHighlight}>{floor?.name ?? ''}</Text>?
            {'\n'}This action cannot be undone.
          </Text>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              disabled={deleting}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnLabel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, styles.deleteBtn]}
              onPress={onConfirm}
              disabled={deleting}
              activeOpacity={0.8}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnLabel}>Delete</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Slot Card ────────────────────────────────────────────────────────────────

interface SlotCardProps {
  slot: ParkingSlot;
  buildingId: string;
  token: string;
  onStatusChanged: (slotId: string, newStatus: SlotStatus) => void;
}

function SlotCard({ slot, buildingId, token, onStatusChanged }: SlotCardProps) {
  const [toggling, setToggling] = useState(false);
  const status = slot.status;
  const color = pickColor(SLOT_STATUS_COLOR, status);
  const bg = pickColor(SLOT_STATUS_BG, status);
  const canToggle = status === 'available' || status === 'maintenance';
  const displayCode = slot.code ?? slot.slotNumber ?? '—';

  const vehicleName =
    typeof slot.vehicleType === 'object' && slot.vehicleType !== null
      ? (slot.vehicleType as { name?: string; code?: string }).name ??
        (slot.vehicleType as { name?: string; code?: string }).code
      : typeof slot.vehicleType === 'string'
      ? slot.vehicleType
      : undefined;

  const handlePress = useCallback(() => {
    if (!canToggle) {
      Alert.alert(
        'Cannot Toggle',
        `Slot "${displayCode}" is ${SLOT_STATUS_LABEL[status]}. Only Available or Maintenance slots can be toggled.`,
      );
      return;
    }
    const newStatus: SlotStatus =
      status === 'available' ? 'maintenance' : 'available';

    Alert.alert(
      'Update Slot Status',
      `Change slot ${displayCode} to "${SLOT_STATUS_LABEL[newStatus]}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Set to ${SLOT_STATUS_LABEL[newStatus]}`,
          onPress: async () => {
            setToggling(true);
            try {
              const res = await updateSlotStatus(
                buildingId,
                slot._id,
                token,
                newStatus,
              );
              const updated =
                (res.data?.data?.item?.status as SlotStatus | undefined) ??
                newStatus;
              onStatusChanged(slot._id, updated);
            } catch (err) {
              Alert.alert(
                'Error',
                err instanceof Error
                  ? err.message
                  : 'Failed to update slot status.',
              );
            } finally {
              setToggling(false);
            }
          },
        },
      ],
    );
  }, [
    slot._id,
    displayCode,
    status,
    buildingId,
    token,
    onStatusChanged,
    canToggle,
  ]);

  return (
    <TouchableOpacity
      style={[styles.slotCard, { borderLeftColor: color }]}
      activeOpacity={canToggle ? 0.65 : 1}
      onPress={handlePress}
      disabled={toggling}
    >
      <View style={styles.slotTop}>
        <Text style={styles.slotCode}>{displayCode}</Text>
        {toggling && <ActivityIndicator size="small" color={Colors.primary} />}
      </View>

      {vehicleName ? (
        <Text style={styles.slotVehicle}>{vehicleName}</Text>
      ) : null}

      <View style={[styles.statusBadge, { backgroundColor: bg }]}>
        <View style={[styles.statusDot, { backgroundColor: color }]} />
        <Text style={[styles.statusText, { color }]}>
          {SLOT_STATUS_LABEL[status] ?? status}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Floor Chip ───────────────────────────────────────────────────────────────

interface FloorChipProps {
  floor: ManagerFloor;
  isSelected: boolean;
  onPress: () => void;
}

function FloorChip({ floor, isSelected, onPress }: FloorChipProps) {
  const slotCount = floor.capacity ?? floor.totalSlots;
  return (
    <TouchableOpacity
      style={[styles.floorChip, isSelected && styles.floorChipSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.floorChipLabel,
          isSelected && styles.floorChipLabelSelected,
        ]}
      >
        {floor.name}
      </Text>
      {slotCount !== undefined && (
        <Text
          style={[
            styles.floorChipCount,
            isSelected && { color: `${Colors.bg}cc` },
          ]}
        >
          {slotCount} slots
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FloorSlotsScreen() {
  const { session } = useAuthStore();
  const token = session?.token ?? '';

  const [building, setBuilding] = useState<ManagerBuilding | null>(null);
  const [floors, setFloors] = useState<ManagerFloor[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [slots, setSlots] = useState<ParkingSlot[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Floor create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [savingCreate, setSavingCreate] = useState(false);

  // Floor edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState<ManagerFloor | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Floor delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ManagerFloor | null>(null);
  const [deleting, setDeleting] = useState(false);

  const buildingId = building?._id ?? null;

  // Ref keeps the current selectedFloorId stable inside fetchAll without
  // changing the callback identity on every selection change.
  const selectedFloorIdRef = useRef<string | null>(null);
  selectedFloorIdRef.current = selectedFloorId;

  // ── Data Fetching ───────────────────────────────────────────────────────────

  const fetchAll = useCallback(
    async (keepSelection = false) => {
      if (!token) return;
      setError(null);

      try {
        // 1. Building
        const buildRes = await getManagerBuildings(token);
        // API returns a single building object; guard against both shapes
        const rawBld = (buildRes as unknown as { data?: unknown })?.data;
        const bld: ManagerBuilding | null = Array.isArray(rawBld)
          ? ((rawBld as ManagerBuilding[])[0] ?? null)
          : ((rawBld as ManagerBuilding) ?? null);

        if (!bld?._id) {
          setBuilding(null);
          setFloors([]);
          setSlots([]);
          return;
        }
        setBuilding(bld);

        // 2. Floors — CRASH-PROOF extraction
        const floorRes = await getFloors(bld._id, token);
        const cleanFloors: ManagerFloor[] = Array.isArray(
          floorRes.data?.data?.items,
        )
          ? floorRes.data.data.items
          : [];
        setFloors(cleanFloors);

        // 3. Slots for selected (or first) floor
        const prevId = keepSelection ? selectedFloorIdRef.current : null;
        const targetId =
          prevId && cleanFloors.some((f) => f._id === prevId)
            ? prevId
            : cleanFloors.length > 0
            ? cleanFloors[0]._id
            : null;

        if (targetId) {
          setSelectedFloorId(targetId);
          const slotRes = await getSlots(bld._id, token, targetId);
          const cleanSlots: ParkingSlot[] = Array.isArray(
            slotRes.data?.data?.items,
          )
            ? slotRes.data.data.items
            : [];
          setSlots(cleanSlots);
        } else {
          setSlots([]);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load floor data.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll(true);
  }, [fetchAll]);

  // ── Floor Selection ─────────────────────────────────────────────────────────

  const onFloorSelected = useCallback(
    async (floorId: string) => {
      if (floorId === selectedFloorId || !buildingId) return;
      setSelectedFloorId(floorId);
      setError(null);
      try {
        const res = await getSlots(buildingId, token, floorId);
        const cleanSlots: ParkingSlot[] = Array.isArray(res.data?.data?.items)
          ? res.data.data.items
          : [];
        setSlots(cleanSlots);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load slots.',
        );
        setSlots([]);
      }
    },
    [buildingId, selectedFloorId, token],
  );

  // ── Slot status optimistic update ───────────────────────────────────────────

  const handleSlotStatusChanged = useCallback(
    (slotId: string, newStatus: SlotStatus) => {
      setSlots((prev) =>
        prev.map((s) => (s._id === slotId ? { ...s, status: newStatus } : s)),
      );
    },
    [],
  );

  // ── Floor CRUD ──────────────────────────────────────────────────────────────

  const openEditModal = useCallback((floor: ManagerFloor) => {
    setEditTarget(floor);
    setShowEditModal(true);
  }, []);

  const openDeleteModal = useCallback((floor: ManagerFloor) => {
    setDeleteTarget(floor);
    setShowDeleteModal(true);
  }, []);

  const handleCreateFloor = useCallback(
    async (input: FloorInput) => {
      if (!buildingId) return;
      setSavingCreate(true);
      try {
        await createFloorApi(buildingId, token, input);
        setShowCreateModal(false);
        await fetchAll(true);
      } catch (err) {
        Alert.alert(
          'Error',
          err instanceof Error ? err.message : 'Failed to create floor.',
        );
      } finally {
        setSavingCreate(false);
      }
    },
    [buildingId, token, fetchAll],
  );

  const handleUpdateFloor = useCallback(
    async (input: FloorInput) => {
      if (!buildingId || !editTarget?._id) return;
      setSavingEdit(true);
      try {
        await updateFloorApi(buildingId, editTarget._id, token, input);
        setShowEditModal(false);
        setEditTarget(null);
        await fetchAll(true);
      } catch (err) {
        Alert.alert(
          'Error',
          err instanceof Error ? err.message : 'Failed to update floor.',
        );
      } finally {
        setSavingEdit(false);
      }
    },
    [buildingId, editTarget, token, fetchAll],
  );

  const handleDeleteFloor = useCallback(async () => {
    if (!buildingId || !deleteTarget?._id) return;
    setDeleting(true);
    try {
      await deleteFloorApi(buildingId, deleteTarget._id, token);
      const wasSelected = selectedFloorIdRef.current === deleteTarget._id;
      setShowDeleteModal(false);
      setDeleteTarget(null);
      if (wasSelected) {
        setSelectedFloorId(null);
        setSlots([]);
      }
      await fetchAll(wasSelected ? false : true);
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to delete floor.',
      );
    } finally {
      setDeleting(false);
    }
  }, [buildingId, deleteTarget, token, fetchAll]);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const selectedFloor = useMemo(
    () => floors.find((f) => f._id === selectedFloorId) ?? null,
    [floors, selectedFloorId],
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading floors…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        >
          {/* Glow decoration */}
          <View style={[styles.glow, { pointerEvents: 'none' }]} />

          {/* ── Building Header ──────────────────────────────────────── */}
          {building && (
            <View style={styles.headerCard}>
              <View style={styles.headerRow}>
                <Ionicons
                  name="business-outline"
                  size={20}
                  color={Colors.primary}
                />
                <Text style={styles.headerTitle}>{building.name}</Text>
                <Text style={styles.headerCode}>{building.code}</Text>
              </View>
            </View>
          )}

          {/* ── Error Banner ─────────────────────────────────────────── */}
          {error && (
            <View style={styles.errorBanner}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={Colors.error}
              />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => fetchAll(true)}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── No Building ──────────────────────────────────────────── */}
          {!building && !loading && (
            <View style={styles.emptyBox}>
              <Ionicons
                name="business-outline"
                size={48}
                color={Colors.textDim}
              />
              <Text style={styles.emptyTitle}>No Building Assigned</Text>
              <Text style={styles.emptyText}>
                You don't have any building assigned to your account yet.
              </Text>
            </View>
          )}

          {/* ── Floors Section ───────────────────────────────────────── */}
          {building && (
            <View style={styles.floorsSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Floors</Text>
                {buildingId && (
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => setShowCreateModal(true)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="add" size={16} color={Colors.primary} />
                    <Text style={styles.addBtnLabel}>Add Floor</Text>
                  </TouchableOpacity>
                )}
              </View>

              {floors.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons
                    name="layers-outline"
                    size={48}
                    color={Colors.textDim}
                  />
                  <Text style={styles.emptyTitle}>No Floors</Text>
                  <Text style={styles.emptyText}>
                    Tap "Add Floor" to create the first floor.
                  </Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.floorsRow}
                >
                  {floors.map((floor) => (
                    <FloorChip
                      key={floor._id}
                      floor={floor}
                      isSelected={selectedFloorId === floor._id}
                      onPress={() => onFloorSelected(floor._id)}
                    />
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* ── Selected Floor Action Bar ─────────────────────────────── */}
          {selectedFloor && (
            <View style={styles.floorActionBar}>
              <View style={styles.floorInfoBlock}>
                <Text style={styles.floorInfoName}>{selectedFloor.name}</Text>
                <Text style={styles.floorInfoSub}>
                  Level {selectedFloor.levelNumber}
                  {' · '}Cap: {selectedFloor.capacity}
                  {selectedFloor.status
                    ? ` · ${FLOOR_STATUS_LABEL[selectedFloor.status as FloorStatus] ?? selectedFloor.status}`
                    : ''}
                </Text>
              </View>
              <View style={styles.floorBtns}>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => openEditModal(selectedFloor)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="pencil-outline"
                    size={17}
                    color={Colors.primary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconBtn, styles.iconBtnDanger]}
                  onPress={() => openDeleteModal(selectedFloor)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="trash-outline"
                    size={17}
                    color={Colors.error}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Slots Grid ───────────────────────────────────────────── */}
          {selectedFloorId && slots.length > 0 && (
            <View style={styles.slotsSection}>
              <Text style={styles.sectionTitle}>
                Slots{' '}
                <Text style={styles.slotCountDim}>({slots.length})</Text>
              </Text>
              <View style={styles.slotsGrid}>
                {slots.map((slot) => (
                  <SlotCard
                    key={slot._id}
                    slot={slot}
                    buildingId={buildingId!}
                    token={token}
                    onStatusChanged={handleSlotStatusChanged}
                  />
                ))}
              </View>
            </View>
          )}

          {/* ── No Slots ─────────────────────────────────────────────── */}
          {selectedFloorId &&
            slots.length === 0 &&
            !loading &&
            !error && (
              <View style={styles.emptyBox}>
                <Ionicons
                  name="car-outline"
                  size={48}
                  color={Colors.textDim}
                />
                <Text style={styles.emptyTitle}>No Slots</Text>
                <Text style={styles.emptyText}>
                  This floor doesn't have any parking slots configured yet.
                </Text>
              </View>
            )}

          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Create Floor Modal ──────────────────────────────────────────── */}
      <FloorFormModal
        visible={showCreateModal}
        mode="create"
        initial={null}
        saving={savingCreate}
        onSubmit={handleCreateFloor}
        onCancel={() => {
          if (!savingCreate) setShowCreateModal(false);
        }}
      />

      {/* ── Edit Floor Modal ────────────────────────────────────────────── */}
      <FloorFormModal
        visible={showEditModal}
        mode="edit"
        initial={editTarget}
        saving={savingEdit}
        onSubmit={handleUpdateFloor}
        onCancel={() => {
          if (!savingEdit) {
            setShowEditModal(false);
            setEditTarget(null);
          }
        }}
      />

      {/* ── Delete Floor Modal ──────────────────────────────────────────── */}
      <DeleteFloorModal
        visible={showDeleteModal}
        floor={deleteTarget}
        deleting={deleting}
        onConfirm={handleDeleteFloor}
        onCancel={() => {
          if (!deleting) {
            setShowDeleteModal(false);
            setDeleteTarget(null);
          }
        }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: 32,
    gap: Spacing.lg,
  },
  glow: {
    position: 'absolute',
    top: -140,
    left: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(249,115,22,0.05)',
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  headerCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.2)',
    padding: Spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '900',
    color: Colors.text,
    flex: 1,
  },
  headerCode: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.textDim,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // ── Error Banner ───────────────────────────────────────────────────────────
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    padding: Spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.error,
    fontWeight: '600',
  },
  retryText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '700',
  },

  // ── Section ────────────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  slotCountDim: {
    fontWeight: '600',
    color: Colors.textMuted,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}14`,
  },
  addBtnLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
  },

  // ── Floors Row ─────────────────────────────────────────────────────────────
  floorsSection: {
    gap: 0,
  },
  floorsRow: {
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  floorChip: {
    backgroundColor: Colors.card,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  floorChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  floorChipLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  floorChipLabelSelected: {
    color: Colors.bg,
  },
  floorChipCount: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 2,
  },

  // ── Floor Action Bar ───────────────────────────────────────────────────────
  floorActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  floorInfoBlock: {
    flex: 1,
    gap: 3,
  },
  floorInfoName: {
    fontSize: FontSize.base,
    fontWeight: '800',
    color: Colors.text,
  },
  floorInfoSub: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  floorBtns: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: `${Colors.primary}40`,
    backgroundColor: `${Colors.primary}0d`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnDanger: {
    borderColor: `${Colors.error}40`,
    backgroundColor: `${Colors.error}0d`,
  },

  // ── Slots Grid ─────────────────────────────────────────────────────────────
  slotsSection: {
    gap: 0,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  slotCard: {
    width: '47%',
    flexGrow: 1,
    minWidth: '45%',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  slotTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slotCode: {
    fontSize: FontSize.base,
    fontWeight: '900',
    color: Colors.text,
  },
  slotVehicle: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Empty State ────────────────────────────────────────────────────────────
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['3xl'],
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '900',
    color: Colors.text,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.xl,
  },

  // ── Modal ──────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    paddingBottom: 40,
    gap: Spacing.md,
  },
  deleteModalSheet: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  modalTitle: {
    fontSize: FontSize.md,
    fontWeight: '900',
    color: Colors.text,
    textAlign: 'center',
  },

  // ── Form Inputs ────────────────────────────────────────────────────────────
  inputLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: -Spacing.xs,
  },
  input: {
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontSize: FontSize.base,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },

  // ── Status Selector ────────────────────────────────────────────────────────
  statusRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statusChip: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardAlt,
    alignItems: 'center',
  },
  statusChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}20`,
  },
  statusChipLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  statusChipLabelSelected: {
    color: Colors.primary,
  },

  // ── Modal Actions ──────────────────────────────────────────────────────────
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardAlt,
    alignItems: 'center',
  },
  cancelBtnLabel: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  submitBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    backgroundColor: Colors.error,
  },
  submitBtnLabel: {
    fontSize: FontSize.base,
    fontWeight: '800',
    color: '#fff',
  },

  // ── Delete Modal ───────────────────────────────────────────────────────────
  deleteIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.errorBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  deleteMessage: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  deleteHighlight: {
    color: Colors.text,
    fontWeight: '800',
  },
});
