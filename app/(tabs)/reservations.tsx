import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ActivityIndicator,
  Pressable,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { listPackages, subscribe, listSubscriptions, cancelSubscription, renewSubscription } from '../../services/longTerm';
import type { LongTermPackage, LongTermSubscription } from '../../types';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay } from 'react-native-reanimated';
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
import { ApiError } from '../../services/api';
import {
  getBuildingFloors,
  getFloorSlots,
} from '../../services/floors';
import type { FloorWithAvailability, SlotItem } from '../../services/floors';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import { styles } from '../../styles/screens/reservations';
import type { Reservation } from '../../types';
import { DateRangePicker } from '../../components/ui/DateRangePicker';
import { BookingDateModal } from '../../components/ui/BookingDateModal';
import { useUIStore } from '../../store/uiStore';
import { guessVehicleCategory } from '../../utils/vehicle';


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

interface Particle {
  id: number;
  size: number;
  color: string;
}

function GlitterParticle({ color, size }: { color: string; size: number }) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 60 + 30;

    tx.value = withTiming(Math.cos(angle) * distance, { duration: 600 });
    ty.value = withTiming(Math.sin(angle) * distance - 20, { duration: 600 });
    opacity.value = withTiming(0, { duration: 600 });
    scale.value = withTiming(0, { duration: 600 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: tx.value },
        { translateY: ty.value },
        { scale: scale.value },
      ],
      opacity: opacity.value,
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: color,
      position: 'absolute',
      alignSelf: 'center',
    };
  });

  return <Animated.View style={animatedStyle} />;
}

function AnimatedPressable({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress: () => void;
  style?: any;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.96, { duration: 100 });
  };
  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 150 });
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={style}>
      <Animated.View style={[{ width: '100%', alignItems: 'center', justifyContent: 'center' }, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ReservationsScreen() {
  const { session } = useAuthStore();
  const token = session?.token ?? '';
  const plates = session?.licensePlates ?? [];

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [subscriptions, setSubscriptions] = useState<LongTermSubscription[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('booked');

  // Custom Alert / Confirm Dialog State
  const [dialog, setDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm' | 'error' | 'success';
    onConfirm?: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'alert',
  });

  const showCustomAlert = useCallback((title: string, message: string, onConfirm?: () => void, type: 'alert' | 'error' | 'success' = 'alert') => {
    setDialog({
      visible: true,
      title,
      message,
      type,
      onConfirm: () => {
        setDialog((d) => ({ ...d, visible: false }));
        onConfirm?.();
      },
      confirmText: 'OK',
    });
  }, []);

  const showCustomConfirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    confirmText = 'Yes, Process',
    cancelText = 'Cancel'
  ) => {
    setDialog({
      visible: true,
      title,
      message,
      type: 'confirm',
      onConfirm: () => {
        setDialog((d) => ({ ...d, visible: false }));
        onConfirm();
      },
      onCancel: () => {
        setDialog((d) => ({ ...d, visible: false }));
        onCancel?.();
      },
      confirmText,
      cancelText,
    });
  }, []);

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

  // Booking modal visibility state
  const [showBookingModal, setShowBookingModal] = useState(false);

  const setTabBarHidden = useUIStore((state) => state.setTabBarHidden);

  useEffect(() => {
    setTabBarHidden(showWizard || showBookingModal || showMapModal);
    return () => setTabBarHidden(false);
  }, [showWizard, showBookingModal, showMapModal, setTabBarHidden]);

  const params = useLocalSearchParams<{ buildingId?: string; packageId?: string; vehicleType?: string; mode?: string; plateNumber?: string }>();

  // Custom package states
  const [bookingType, setBookingType] = useState<'hourly' | 'package'>(() => {
    return params.packageId || params.mode === 'package' ? 'package' : 'hourly';
  });
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [packages, setPackages] = useState<LongTermPackage[]>([]);
  const [fetchingPackages, setFetchingPackages] = useState(false);
  const [reserveDedicatedSlot, setReserveDedicatedSlot] = useState<boolean>(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);

  const triggerGlitter = () => {
    const newParticles: Particle[] = Array.from({ length: 10 }).map((_, i) => ({
      id: Date.now() + i,
      size: Math.random() * 6 + 4,
      color: ['#fbbf24', '#f59e0b', '#d97706', '#fb7185', '#f472b6', '#38bdf8'][Math.floor(Math.random() * 6)],
    }));
    setParticles(newParticles);
    setTimeout(() => {
      setParticles([]);
    }, 800);
  };

  // Helper to round to nearest 30-minute interval on or after current time
  const getNearestValidTime = (date: Date): Date => {
    const d = new Date(date);
    const min = d.getMinutes();
    if (min > 30) {
      d.setHours(d.getHours() + 1);
      d.setMinutes(0, 0, 0);
    } else if (min > 0) {
      d.setMinutes(30, 0, 0);
    } else {
      d.setMinutes(0, 0, 0);
    }
    return d;
  };

  // Native date-time pickers
  const [startDateTime, setStartDateTime] = useState<Date>(() => {
    return getNearestValidTime(new Date());
  });
  const [endDateTime, setEndDateTime] = useState<Date>(() => {
    const start = getNearestValidTime(new Date());
    return new Date(start.getTime() + 3600000);
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

  const [renewingId, setRenewingId] = useState<string | null>(null);

  const handleRenewSubscription = async (r: any) => {
    const sub = r.rawSubscription;
    if (!sub || !sub.package) return;
    const msg = `Renew package "${sub.package.name}" for license plate "${sub.plateNumber}"?\n\nPrice: ${fmtVND(sub.package.price)} will be deducted from your wallet balance.`;

    showCustomConfirm(
      'Renew Subscription',
      msg,
      async () => {
        setRenewingId(r._id);
        try {
          await renewSubscription(token, sub._id);
          showCustomAlert('Success', 'Subscription renewed successfully!', () => load(), 'success');
        } catch (err) {
          showCustomAlert('Error', err instanceof Error ? err.message : 'Renewal failed', undefined, 'error');
        } finally {
          setRenewingId(null);
        }
      },
      undefined,
      'Renew',
      'Cancel'
    );
  };

  // ── Load reservations ──────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!token) return;
    setLoadError(null);
    try {
      const [resData, subData] = await Promise.all([
        listReservations(token),
        listSubscriptions(token).catch(() => []),
      ]);
      setReservations(resData);
      setSubscriptions(subData);
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

  // ── Cancel ─────────────────────────────────────────────────────────────────

  const doCancel = async (r: any) => {
    setCancellingId(r._id);
    try {
      if ((r as any).isSubscription) {
        await cancelSubscription(token, r._id);
        await load();
        const price = r.fee ?? 0;
        const refundAmt = Math.round(price * 0.95);
        const successMsg = `Your package subscription has been cancelled.\n\nRefunded ${fmtVND(refundAmt)} (95%) to your wallet.`;
        showCustomAlert('Subscription Cancelled', successMsg, undefined, 'success');
      } else {
        const result = await cancelReservation(token, r._id);
        await load();

        const refundPct = result.refundPercent ?? r.refundPercent ?? 0;
        const refundAmt = result.refund ?? Math.round(((r.fee ?? 0) * refundPct) / 100);

        let successMsg = 'Your reservation has been cancelled.';
        if (refundPct > 0) {
          successMsg += `\n\nRefunded ${fmtVND(refundAmt)} (${refundPct}%) to your wallet.`;
        } else {
          successMsg += '\n\nThe deposit is non-refundable and has been forfeited as a cancellation fee.';
        }

        showCustomAlert('Reservation Cancelled', successMsg, undefined, 'success');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not cancel reservation';
      showCustomAlert('Error', msg, undefined, 'error');
    } finally {
      setCancellingId(null);
    }
  };

  const handleCancel = (r: any) => {
    if ((r as any).isSubscription) {
      const now = new Date();
      const startDate = new Date(r.startTime);
      const diffMs = now.getTime() - startDate.getTime();
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

      if (now.getTime() > startDate.getTime() && diffMs > threeDaysMs) {
        const errMsg = "This package subscription cannot be cancelled because it has exceeded the 3-day self-cancellation limit.";
        showCustomAlert('Policy Limit', errMsg, undefined, 'error');
        return;
      }

      const price = r.fee ?? 0;
      const refundAmt = Math.round(price * 0.95);
      const forfeitAmt = price - refundAmt;
      const msg = `Cancel long-term subscription for plate "${r.plateNumber}"?\n\nYou will be refunded ${fmtVND(refundAmt)} (95% of price) to your wallet. The remaining ${fmtVND(forfeitAmt)} (5%) will be forfeited as a cancellation fee.`;

      showCustomConfirm(
        'Cancel Subscription',
        msg,
        () => doCancel(r),
        undefined,
        'Cancel Subscription',
        'Keep Subscription'
      );
      return;
    }

    const refundPct = r.refundPercent ?? 0;
    const depositPaid = r.fee ?? 0;
    const refundAmt = Math.round((depositPaid * refundPct) / 100);
    const forfeitAmt = depositPaid - refundAmt;

    let refundMsg = '';
    if (refundPct > 0) {
      refundMsg = `You will be refunded ${fmtVND(refundAmt)} (${refundPct}% of deposit) to your wallet. The remaining ${fmtVND(forfeitAmt)} will be forfeited as a cancellation fee.`;
    } else {
      refundMsg = `Warning: The deposit of ${fmtVND(depositPaid)} is non-refundable and will be forfeited.`;
    }

    const msg = `Cancel reservation for plate "${r.plateNumber}"?\n\n${refundMsg}`;
    showCustomConfirm(
      'Cancel Reservation',
      msg,
      () => doCancel(r),
      undefined,
      'Cancel & Process Refund',
      'Keep Reservation'
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
    setBookingType('hourly');
    setSelectedPackageId('');
    setReserveDedicatedSlot(false);

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

  const openWizardWithParams = async (bldId: string, pkgId: string, vtCodeVal: string, pltNum?: string) => {
    setStep(1);
    setCreateError(null);
    setShowWizard(true);
    setDisplaySlotCode('');
    setWizard((prev) => ({
      ...prev,
      buildingId: bldId,
      plateNumber: pltNum || (plates[0]?.plateNumber ?? ''),
    }));

    setFetchingBuildings(true);
    try {
      const data = await listBuildings(token);
      setBuildings(data);
    } catch {
      setBuildings([]);
    } finally {
      setFetchingBuildings(false);
    }

    if (bldId) {
      setFetchingVT(true);
      try {
        const types = await getBuildingVehicleTypes(token, bldId);
        setVehicleTypes(types);
        let matchedVt = types.find(t => t.code === vtCodeVal || guessVehicleCategory(t.name) === vtCodeVal);
        if (!matchedVt && types.length > 0) {
          matchedVt = types[0];
        }
        if (matchedVt) {
          const cat = guessVehicleCategory(matchedVt.name);
          const matchPlate = cat ? plates.find((p) => p.vehicleType === cat) : plates[0];
          setWizard((p) => ({
            ...p,
            vehicleTypeId: matchedVt!._id,
            plateNumber: pltNum || (matchPlate?.plateNumber ?? ''),
          }));
        }
      } catch {
        setVehicleTypes([]);
      } finally {
        setFetchingVT(false);
      }

      if (pkgId) {
        setBookingType('package');
        setSelectedPackageId(pkgId);
        setReserveDedicatedSlot(false);
        setFetchingPackages(true);
        try {
          const pkgs = await listPackages(token, bldId);
          setPackages(pkgs);
        } catch {
          setPackages([]);
        } finally {
          setFetchingPackages(false);
        }
      } else {
        setBookingType('hourly');
      }
    }
  };

  useEffect(() => {
    if ((params.buildingId || params.packageId || params.plateNumber) && token) {
      openWizardWithParams(params.buildingId ?? '', params.packageId ?? '', params.vehicleType ?? '', params.plateNumber ?? '');
    }
  }, [params.buildingId, params.packageId, params.vehicleType, params.plateNumber, token]);

  // Auto-clear selected package if the selected vehicle type changes
  useEffect(() => {
    if (bookingType === 'package' && selectedPackageId && wizard.vehicleTypeId) {
      const activePkg = packages.find((p) => p._id === selectedPackageId);
      if (activePkg) {
        const pkgVtId = typeof activePkg.vehicleType === 'object' && activePkg.vehicleType ? activePkg.vehicleType._id : activePkg.vehicleType;
        if (pkgVtId !== wizard.vehicleTypeId) {
          setSelectedPackageId('');
        }
      }
    }
  }, [wizard.vehicleTypeId, selectedPackageId, packages, bookingType]);

  const closeWizard = () => setShowWizard(false);

  // Step 1: building selected → fetch vehicle types, then auto-select a matching plate
  const handleSelectBuilding = async (buildingId: string) => {
    setWizard((p) => ({ ...p, buildingId, vehicleTypeId: '', plateNumber: '' }));
    setVehicleTypes([]);
    setPackages([]);
    setSelectedPackageId('');
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

      setFetchingPackages(true);
      const pkgs = await listPackages(token, buildingId);
      setPackages(pkgs.filter(p => p.isActive));
    } catch {
      setVehicleTypes([]);
      setPackages([]);
    } finally {
      setFetchingVT(false);
      setFetchingPackages(false);
    }
  };

  // Step 1 → Step 2
  const goToStep2 = async () => {
    if (!wizard.buildingId) {
      showCustomAlert('Missing Info', 'Please select a building.');
      return;
    }
    if (!wizard.vehicleTypeId) {
      showCustomAlert('Missing Info', 'Please select a vehicle type.');
      return;
    }
    if (!wizard.plateNumber.trim()) {
      showCustomAlert('Missing Info', 'Please select or enter a license plate.');
      return;
    }
    // Validate plate matches the selected vehicle type category
    const selectedVt = vehicleTypes.find((vt) => vt._id === wizard.vehicleTypeId);
    if (selectedVt) {
      const vtCategory = guessVehicleCategory(selectedVt.name);
      const plate = plates.find((p) => p.plateNumber === wizard.plateNumber);
      if (vtCategory && plate && plate.vehicleType !== vtCategory) {
        showCustomAlert(
          'Vehicle Mismatch',
          `This building only accepts ${vtCategory === 'motorcycle' ? 'motorcycles' : 'cars'}. Please select a matching plate.`,
          undefined,
          'error'
        );
        return;
      }
    }
    if (bookingType === 'package' && !selectedPackageId) {
      showCustomAlert('Missing Info', 'Please select a package.');
      return;
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
    if (bookingType === 'package' && !reserveDedicatedSlot) {
      setCreateError(null);
      const start = getNearestValidTime(new Date());
      const end = new Date(start.getTime() + 3600000);
      setStartDateTime(start);
      setEndDateTime(end);
      setWizard((prev) => ({
        ...prev,
        startTime: toWizardStr(start),
        endTime: toWizardStr(end),
        floorId: '',
        slotId: '',
      }));
      setStep(3);
      return;
    }

    if (!wizard.floorId) {
      showCustomAlert('Missing Info', 'Please select a floor.', undefined, 'error');
      return;
    }
    if (!wizard.slotId) {
      showCustomAlert('Missing Info', 'Please select a parking slot.', undefined, 'error');
      return;
    }
    setCreateError(null);

    const start = getNearestValidTime(new Date());
    const end = new Date(start.getTime() + 3600000);

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

    if (bookingType === 'package') {
      let startIso: string;
      try {
        startIso = new Date(wizard.startTime.trim()).toISOString();
      } catch {
        setCreateError('Invalid start date format.');
        return;
      }
      try {
        setCreating(true);
        const result = await subscribe(
          token,
          selectedPackageId,
          wizard.plateNumber.trim().toUpperCase(),
          wizard.buildingId,
          wizard.slotId || undefined,
          startIso
        );

        const resAny = result as any;
        if (resAny.checkoutUrl) {
          const payMsg = 'Your wallet balance is insufficient. Redirecting to payment gateway...';
          showCustomConfirm(
            'Redirecting to Payment',
            payMsg,
            () => {
              if (Platform.OS === 'web') {
                window.open(resAny.checkoutUrl, '_blank');
              } else {
                import('react-native').then(({ Linking }) => {
                  Linking.openURL(resAny.checkoutUrl);
                });
              }
              closeWizard();
              load();
            },
            () => {
              closeWizard();
              load();
            },
            'Pay Now',
            'Cancel'
          );
        } else {
          const okMsg = 'Successfully subscribed to package!';
          showCustomAlert(
            'Subscription Confirmed',
            okMsg,
            () => {
              closeWizard();
              load();
              router.replace({ pathname: '/packages', params: { tab: 'my' } });
            },
            'success'
          );
        }
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : 'Failed to subscribe to package');
      } finally {
        setCreating(false);
      }
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
      const depositTxt = result.depositAmount
        ? `\nDeposit paid: ${fmtVND(result.depositAmount)} (15%)\nRemaining at checkout: ${fmtVND((result.estimatedFee ?? 0) - (result.depositAmount ?? 0))}`
        : '';
      showCustomAlert(
        'Reservation Confirmed',
        `Your slot is booked.${depositTxt}`,
        () => {
          closeWizard();
          load();
        },
        'success'
      );
    } catch (err) {
      if (err instanceof ApiError && err.errorCode === 'PLATE_RECENTLY_CANCELLED') {
        setCreateError(
          'Biển số này đã hủy đặt chỗ tại tòa nhà trong vòng 24 giờ qua. Vui lòng thử lại sau.'
        );
      } else {
        setCreateError(err instanceof Error ? err.message : 'Failed to create reservation');
      }
    } finally {
      setCreating(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const activePkg = packages.find((p) => p._id === selectedPackageId);

  const combinedBookings = React.useMemo(() => {
    const normReservations = reservations.map((r) => ({ ...r, isSubscription: false }));
    const normSubscriptions = subscriptions.map((s) => ({
      _id: s._id,
      code: s.package ? `PKG-${s.package.name.substring(0, 3).toUpperCase()}` : 'PKG',
      plateNumber: s.plateNumber,
      building: s.building || s.package?.building || { name: 'Unknown Building' },
      slot: s.slot || undefined,
      startTime: s.startDate,
      endTime: s.endDate,
      fee: s.package?.price ?? 0,
      estimatedFee: s.package?.price ?? 0,
      status: (s.status === 'active' ? 'confirmed' : (s.status === 'pending' ? 'pending' : (s.status === 'cancelled' ? 'cancelled' : 'expired'))) as Reservation['status'],
      isSubscription: true,
      rawSubscription: s,
    }));
    return [...normReservations, ...normSubscriptions].sort((a, b) => {
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
    });
  }, [reservations, subscriptions]);

  const filtered = combinedBookings.filter((r) =>
    filter === 'booked' ? !isCancelled(r.status) : isCancelled(r.status),
  );

  const finalFiltered = (() => {
    const startOfDay = new Date(fromDate);
    startOfDay.setHours(0, 0, 0, 0);
    return filtered.filter((r) => {
      const d = new Date(r.startTime);
      if (d < startOfDay) return false;
      if (toDate) {
        const endOfDay = new Date(toDate);
        endOfDay.setHours(23, 59, 59, 999);
        return d <= endOfDay;
      }
      return true;
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
    const depPercent = feeEstimate.depositPercent ?? 15;
    return {
      duration,
      depositText: `Deposit now (${depPercent}%): ${fmtVND(feeEstimate.depositAmount)}`,
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

            <AnimatedCard key={r._id} index={idx} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.plateTxt}>{r.plateNumber}</Text>
                    {(r as any).isSubscription && (
                      <View style={{ backgroundColor: 'rgba(249,115,22,0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ color: Colors.primary, fontSize: 9, fontWeight: '800' }}>LONG-TERM</Text>
                      </View>
                    )}
                  </View>
                  {r.building && <Text style={styles.buildingTxt}>{r.building.name}</Text>}
                  {r.slot && (
                    <Text style={styles.slotTxt}>
                      Slot {r.slot.code}
                      {r.slot.floor !== undefined ? ` · Floor ${typeof r.slot.floor === 'object'
                        ? ((r.slot.floor as any).name || (r.slot.floor as any).code || '')
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
                      {(r as any).isSubscription ? 'Package Price: ' : 'Deposit paid: '}
                      <Text style={styles.metaStrong}>{fmtVND(r.fee)}</Text>
                      {!(r as any).isSubscription && ' (15%)'}
                    </Text>
                  </View>
                </View>
              ) : null}

              {(r as any).isSubscription && (r as any).rawSubscription?.package?.maxHoursPerDay ? (
                <View style={[styles.metaBox, { marginTop: 4 }]}>
                  <View style={styles.metaItem}>
                    <Ionicons name="hourglass-outline" size={14} color={Colors.textMuted} />
                    <Text style={styles.metaText}>
                      Max Hours/Day: <Text style={styles.metaStrong}>{(r as any).rawSubscription.package.maxHoursPerDay} hrs</Text>
                    </Text>
                  </View>
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs }}>
                {(r.status === 'pending' || r.status === 'confirmed') && (
                  <Button
                    label={cancellingId === r._id ? 'Cancelling...' : ((r as any).isSubscription ? 'Cancel Subscription' : 'Cancel Reservation')}
                    onPress={() => handleCancel(r)}
                    variant="danger"
                    size="sm"
                    loading={cancellingId === r._id}
                    style={{ alignSelf: 'flex-start' }}
                  />
                )}
                {(r as any).isSubscription && (r.status === 'confirmed' || r.status === 'expired') && !(r as any).rawSubscription?.slotReleased && (
                  <Button
                    label={renewingId === r._id ? 'Renewing...' : 'Renew'}
                    onPress={() => handleRenewSubscription(r)}
                    size="sm"
                    loading={renewingId === r._id}
                    style={{ alignSelf: 'flex-start' }}
                  />
                )}
              </View>
            </AnimatedCard>
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

                  {/* Booking Type selection */}
                  {wizard.buildingId ? (
                    <View style={{ gap: 6 }}>
                      <Text style={styles.fieldLabel}>Booking Type</Text>
                      <View style={styles.chipRow}>
                        <TouchableOpacity
                          style={[styles.chip, bookingType === 'hourly' && styles.chipActive]}
                          onPress={() => {
                            setBookingType('hourly');
                            setSelectedPackageId('');
                          }}
                        >
                          <Text style={[styles.chipText, bookingType === 'hourly' && styles.chipTextActive]}>
                            Hourly Reservation
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.chip, bookingType === 'package' && styles.chipActive]}
                          onPress={() => {
                            setBookingType('package');
                          }}
                        >
                          <Text style={[styles.chipText, bookingType === 'package' && styles.chipTextActive]}>
                            Long-term Package
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : null}

                  {/* Package Selector */}
                  {bookingType === 'package' && !!wizard.buildingId && (
                    <View style={{ gap: Spacing.xs }}>
                      <Text style={styles.fieldLabel}>Select Subscription Package</Text>
                      {fetchingPackages ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                      ) : packages.length === 0 ? (
                        <Text style={styles.hintText}>No packages available for this building.</Text>
                      ) : (
                        <View style={{ gap: Spacing.sm }}>
                          {packages.filter((pkg) => {
                            const pkgVtId = typeof pkg.vehicleType === 'object' && pkg.vehicleType ? pkg.vehicleType._id : pkg.vehicleType;
                            return pkgVtId === wizard.vehicleTypeId;
                          }).map((pkg) => {
                            const isSelected = selectedPackageId === pkg._id;
                            return (
                              <TouchableOpacity
                                key={pkg._id}
                                style={[styles.pkgSelectCard, isSelected && styles.pkgSelectCardActive]}
                                onPress={() => {
                                  setSelectedPackageId(pkg._id);
                                  triggerGlitter();
                                }}
                              >
                                {isSelected && particles.map((p) => (
                                  <GlitterParticle key={p.id} color={p.color} size={p.size} />
                                ))}
                                <View style={{ flex: 1, gap: 4 }}>
                                  <Text style={[styles.pkgSelectName, isSelected && { color: Colors.primary }]}>{pkg.name}</Text>
                                  <Text style={styles.pkgSelectDuration}>{pkg.durationDays} Days</Text>
                                </View>
                                <Text style={styles.pkgSelectPrice}>{(pkg.price).toLocaleString('en-US')} VND</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Dedicated Slot option removed from Step 1 */}

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

                  {/* Ticketbox for optional parking slot choice */}
                  {bookingType === 'package' && (
                    <View style={{ gap: 6 }}>
                      <Text style={styles.fieldLabel}>Parking Slot Selection Option</Text>
                      <TouchableOpacity
                        style={styles.checkboxContainer}
                        activeOpacity={0.8}
                        onPress={() => setReserveDedicatedSlot(!reserveDedicatedSlot)}
                      >
                        <Ionicons
                          name={reserveDedicatedSlot ? 'checkbox-outline' : 'square-outline'}
                          size={20}
                          color={reserveDedicatedSlot ? Colors.primary : Colors.textDim}
                        />
                        <Text style={styles.checkboxLabel}>Do you want to choose your own slot parking?</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {(bookingType !== 'package' || reserveDedicatedSlot) ? (
                    <>
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
                            <Text style={styles.openMapBtnText}>🗺️ Choose Parking Slot (2D/3D)</Text>
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
                                    <Text style={styles.legendText2D}>Available</Text>
                                  </View>
                                  <View style={styles.legendItem2D}>
                                    <View style={[styles.legendDot2D, { borderColor: '#475569', backgroundColor: 'rgba(71, 85, 105, 0.1)' }]} />
                                    <Text style={styles.legendText2D}>Reserved</Text>
                                  </View>
                                  <View style={styles.legendItem2D}>
                                    <View style={[styles.legendDot2D, { borderColor: 'rgba(255,255,255,0.25)', borderStyle: 'dashed', backgroundColor: 'transparent' }]} />
                                    <Text style={styles.legendText2D}>Unavailable</Text>
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
                                      // Try to guess by code prefix (M for motorcycle, C for car)
                                      const codeUpper = sItem.code.toUpperCase();
                                      if (codeUpper.startsWith('M')) return '🏍️';
                                      if (codeUpper.startsWith('C')) return '🚗';

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
                                          showsVerticalScrollIndicator={true}
                                          contentContainerStyle={styles.scroll2DVertical}
                                          style={{ flex: 1, height: '100%' }}
                                        >
                                          <ScrollView
                                            horizontal
                                            showsHorizontalScrollIndicator={true}
                                            contentContainerStyle={styles.scroll2DHorizontal}
                                            style={{ flex: 1, width: '100%' }}
                                          >
                                            <View style={styles.basement2DContainer}>
                                              {/* ROW T (TOP) */}
                                              <View style={styles.rowHeaderRow2D}>
                                                <Text style={styles.rowHeader2D}>ROW T (TOP)</Text>
                                              </View>
                                              <View style={styles.parkingLane2D}>
                                                {topRowSlots.map((slot) => {
                                                  const isCompatible = !vtCategory || (
                                                    vtCategory === 'car' ? !slot.code.toUpperCase().startsWith('M') : !slot.code.toUpperCase().startsWith('C')
                                                  );
                                                  const isAvailable = slot.status === 'available' && isCompatible;
                                                  const isSelectable = isAvailable && slot.selectable !== false && !slot.owner;
                                                  const isSelected = wizard.slotId === slot._id;
                                                  return (
                                                    <TouchableOpacity
                                                      key={slot._id}
                                                      style={[
                                                        styles.slotCell2D,
                                                        { width: slotWidth + 12, height: slotHeight + 12 },
                                                        isSelected && styles.slotCell2DSelected,
                                                        !isSelectable && styles.slotCell2DDisabled,
                                                      ]}
                                                      onPress={() => {
                                                        if (isSelectable) {
                                                          setWizard((p) => ({ ...p, slotId: slot._id }));
                                                          setDisplaySlotCode(slot.code);
                                                        } else {
                                                          Alert.alert('Slot Occupied', 'This slot is already reserved or occupied.');
                                                        }
                                                      }}
                                                      activeOpacity={0.8}
                                                    >
                                                      {isSelectable ? (
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

                                              {/* DRIVEWAY (CENTER LANE) */}
                                              <View style={styles.drivewayLine2D}>
                                                <Text style={styles.drivewayArrow2D}>◀── ENTRY (IN)</Text>
                                                <View style={styles.dashedDivider2D} />
                                                <Text style={styles.drivewayText2D}>DRIVEWAY</Text>
                                                <View style={styles.dashedDivider2D} />
                                                <Text style={styles.drivewayArrow2D}>EXIT (OUT) ──▶</Text>
                                              </View>

                                              {/* ROW T (BOTTOM) */}
                                              <View style={styles.rowHeaderRow2D}>
                                                <Text style={styles.rowHeader2D}>ROW T (BOTTOM)</Text>
                                              </View>
                                              <View style={styles.parkingLane2D}>
                                                {bottomRowSlots.map((slot) => {
                                                  const isCompatible = !vtCategory || (
                                                    vtCategory === 'car' ? !slot.code.toUpperCase().startsWith('M') : !slot.code.toUpperCase().startsWith('C')
                                                  );
                                                  const isAvailable = slot.status === 'available' && isCompatible;
                                                  const isSelectable = isAvailable && slot.selectable !== false && !slot.owner;
                                                  const isSelected = wizard.slotId === slot._id;
                                                  return (
                                                    <TouchableOpacity
                                                      key={slot._id}
                                                      style={[
                                                        styles.slotCell2D,
                                                        { width: slotWidth + 12, height: slotHeight + 12 },
                                                        isSelected && styles.slotCell2DSelected,
                                                        !isSelectable && styles.slotCell2DDisabled,
                                                      ]}
                                                      onPress={() => {
                                                        if (isSelectable) {
                                                          setWizard((p) => ({ ...p, slotId: slot._id }));
                                                          setDisplaySlotCode(slot.code);
                                                        } else {
                                                          Alert.alert('Slot Occupied', 'This slot is already reserved or occupied.');
                                                        }
                                                      }}
                                                      activeOpacity={0.8}
                                                    >
                                                      {isSelectable ? (
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
                                                {/* Basement pillars */}
                                                <View style={[styles.basementColumn, { top: 6, left: '50%', marginLeft: -7, opacity: 0.9 }]} />
                                                <View style={[styles.basementColumn, { bottom: 6, left: '50%', marginLeft: -7, opacity: 0.9 }]} />

                                                {/* Two symmetric parking rows flanking the driveway */}
                                                <View style={styles.basementLanesRow}>

                                                  {/* Left Parking Lane (Bottom Row) */}
                                                  <View style={styles.parkingLane3D}>
                                                    {bottomRowSlots.map((slot) => {
                                                      const isCompatible = !vtCategory || (
                                                        vtCategory === 'car' ? !slot.code.toUpperCase().startsWith('M') : !slot.code.toUpperCase().startsWith('C')
                                                      );
                                                      const isAvailable = slot.status === 'available' && isCompatible;
                                                      const isSelectable = isAvailable && slot.selectable !== false && !slot.owner;
                                                      const isSelected = wizard.slotId === slot._id;

                                                      return (
                                                        <TouchableOpacity
                                                          key={slot._id}
                                                          style={[styles.slot3DBoxContainer, { width: slotWidth, height: slotHeight }]}
                                                          onPress={() => {
                                                            if (isSelectable) {
                                                              setWizard((p) => ({ ...p, slotId: slot._id }));
                                                              setDisplaySlotCode(slot.code);
                                                            } else {
                                                              Alert.alert('Slot Occupied', 'This slot is already reserved or occupied.');
                                                            }
                                                          }}
                                                          activeOpacity={0.8}
                                                        >
                                                          <View style={[styles.faceTop3D, { top: -gapVal, left: gapVal }, isSelected && styles.faceTopSelected3D, !isSelectable && styles.faceTopDisabled3D]}>
                                                            <Text style={[styles.codeText3D, { fontSize: fontSize3D }]}>{slot.code}</Text>
                                                            {!isSelectable && <Text style={[styles.carSymbol3D, { fontSize: slotWidth < 60 ? 12 : 15 }]}>{getSlotSymbol(slot)}</Text>}
                                                          </View>
                                                          <View style={[styles.faceLeft3D, { width: gapVal }, isSelected && styles.faceLeftSelected3D, !isSelectable && styles.faceLeftDisabled3D]} />
                                                          <View style={[styles.faceRight3D, { height: gapVal }, isSelected && styles.faceRightSelected3D, !isSelectable && styles.faceRightDisabled3D]} />
                                                        </TouchableOpacity>
                                                      );
                                                    })}
                                                  </View>

                                                  {/* Driveway Space */}
                                                  <View style={styles.drivewayLine3D}>
                                                    <View style={styles.dashedDivider} />
                                                  </View>

                                                  {/* Right Parking Lane (Top Row) */}
                                                  <View style={styles.parkingLane3D}>
                                                    {topRowSlots.map((slot) => {
                                                      const isCompatible = !vtCategory || (
                                                        vtCategory === 'car' ? !slot.code.toUpperCase().startsWith('M') : !slot.code.toUpperCase().startsWith('C')
                                                      );
                                                      const isAvailable = slot.status === 'available' && isCompatible;
                                                      const isSelectable = isAvailable && slot.selectable !== false && !slot.owner;
                                                      const isSelected = wizard.slotId === slot._id;

                                                      return (
                                                        <TouchableOpacity
                                                          key={slot._id}
                                                          style={[styles.slot3DBoxContainer, { width: slotWidth, height: slotHeight }]}
                                                          onPress={() => {
                                                            if (isSelectable) {
                                                              setWizard((p) => ({ ...p, slotId: slot._id }));
                                                              setDisplaySlotCode(slot.code);
                                                            } else {
                                                              Alert.alert('Slot Occupied', 'This slot is already reserved or occupied.');
                                                            }
                                                          }}
                                                          activeOpacity={0.8}
                                                        >
                                                          <View style={[styles.faceTop3D, { top: -gapVal, left: gapVal }, isSelected && styles.faceTopSelected3D, !isSelectable && styles.faceTopDisabled3D]}>
                                                            <Text style={[styles.codeText3D, { fontSize: fontSize3D }]}>{slot.code}</Text>
                                                            {!isSelectable && <Text style={[styles.carSymbol3D, { fontSize: slotWidth < 60 ? 12 : 15 }]}>{getSlotSymbol(slot)}</Text>}
                                                          </View>
                                                          <View style={[styles.faceLeft3D, { width: gapVal }, isSelected && styles.faceLeftSelected3D, !isSelectable && styles.faceLeftDisabled3D]} />
                                                          <View style={[styles.faceRight3D, { height: gapVal }, isSelected && styles.faceRightSelected3D, !isSelectable && styles.faceRightDisabled3D]} />
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
                    </>
                  ) : null}
                </View>
              </ScrollView>
            )}

            {/* ── STEP 3 ────────────────────────────────────────────────────── */}
            {step === 3 && (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.wizardScrollView}>
                <View style={{ gap: Spacing.md, paddingBottom: Spacing.lg }}>

                  {/* Choose Date & Time Trigger Card */}
                  <TouchableOpacity
                    style={styles.timeTriggerCard}
                    onPress={() => setShowBookingModal(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.timeTriggerLabel}>Booking Date & Time</Text>
                      <Text style={styles.timeTriggerValue}>Choose Date & Time</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
                  </TouchableOpacity>

                  {/* Selected Time Preview */}
                  <View style={styles.timePreviewCard}>
                    <View style={styles.timePreviewColumn}>
                      <Text style={styles.timePreviewLabel}>CHECK-IN</Text>
                      <Text style={styles.timePreviewValue}>{fmtDate(startDateTime.toISOString())}</Text>
                    </View>
                    <View style={styles.timePreviewDivider} />
                    <View style={styles.timePreviewColumn}>
                      <Text style={styles.timePreviewLabel}>CHECK-OUT</Text>
                      <Text style={styles.timePreviewValue}>
                        {bookingType === 'package' && activePkg
                          ? fmtDate(new Date(startDateTime.getTime() + activePkg.durationDays * 24 * 60 * 60 * 1000).toISOString())
                          : fmtDate(endDateTime.toISOString())}
                      </Text>
                    </View>
                  </View>

                  {/* Reservation Summary */}
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

                      {(!bookingType || bookingType === 'hourly' || reserveDedicatedSlot) ? (
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
                      ) : null}
                    </View>
                  </View>

                  {bookingType === 'package' && activePkg ? (
                    <View style={styles.billingCard}>
                      <View style={styles.billingHeader}>
                        <Ionicons name="wallet-outline" size={16} color={Colors.primary} />
                        <Text style={styles.billingTitle}>Pricing Package</Text>
                      </View>
                      <View style={styles.billingRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="pricetag-outline" size={14} color={Colors.textDim} />
                          <Text style={styles.billingLabel}>Package Price</Text>
                        </View>
                        <Text style={[styles.billingValue, { color: Colors.primary, fontWeight: '900' }]}>
                          {(activePkg.price).toLocaleString('en-US')} VND
                        </Text>
                      </View>
                    </View>
                  ) : estimatedFeeInfo ? (
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
                              <Text style={[styles.billingLabel, { color: '#f59e0b', fontWeight: '800' }]}>Deposit Now ({feeEstimate?.depositPercent ?? 15}%)</Text>
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

            {/* Collapsible Summary Sheet */}
            {step > 1 && (
              <View style={[styles.bottomSummarySheet, summaryExpanded && styles.bottomSummarySheetExpanded]}>
                <TouchableOpacity
                  style={styles.summarySheetHeader}
                  activeOpacity={0.8}
                  onPress={() => setSummaryExpanded(!summaryExpanded)}
                >
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="receipt-outline" size={18} color={Colors.primary} />
                    <Text style={styles.summarySheetTitle}>Booking Summary</Text>
                  </View>
                  <Ionicons
                    name={summaryExpanded ? 'chevron-down-outline' : 'chevron-up-outline'}
                    size={18}
                    color={Colors.textMuted}
                  />
                </TouchableOpacity>

                {summaryExpanded && (
                  <View style={styles.summarySheetDetails}>
                    <View style={styles.summarySheetRow}>
                      <Text style={styles.summarySheetLabel}>Building</Text>
                      <Text style={styles.summarySheetValue}>{selectedBuilding?.name}</Text>
                    </View>
                    <View style={styles.summarySheetRow}>
                      <Text style={styles.summarySheetLabel}>Vehicle / Plate</Text>
                      <Text style={styles.summarySheetValue}>
                        {vtCategory === 'motorcycle' ? 'Motorbike' : vtCategory === 'car' ? 'Car' : ''}
                        {vtCategory ? '/' : ''}
                        {wizard.plateNumber}
                      </Text>
                    </View>
                    {(!bookingType || bookingType === 'hourly' || reserveDedicatedSlot) && wizard.slotId ? (
                      <View style={styles.summarySheetRow}>
                        <Text style={styles.summarySheetLabel}>Spot</Text>
                        <Text style={styles.summarySheetValue}>Floor {selectedFloor?.code} · Slot {displaySlotCode || slots.find(s => s._id === wizard.slotId)?.code}</Text>
                      </View>
                    ) : null}
                    {bookingType === 'package' && activePkg ? (
                      <>
                        <View style={styles.summarySheetRow}>
                          <Text style={styles.summarySheetLabel}>Package</Text>
                          <Text style={styles.summarySheetValue}>{activePkg.name}</Text>
                        </View>
                        <View style={styles.summarySheetRow}>
                          <Text style={styles.summarySheetLabel}>Price</Text>
                          <Text style={[styles.summarySheetValue, { color: Colors.primary, fontWeight: '900' }]}>{(activePkg.price).toLocaleString('en-US')} VND</Text>
                        </View>
                      </>
                    ) : feeEstimate ? (
                      <View style={styles.summarySheetRow}>
                        <Text style={styles.summarySheetLabel}>Est. Fee</Text>
                        <Text style={[styles.summarySheetValue, { color: Colors.primary }]}>{(feeEstimate.estimatedFee).toLocaleString('en-US')} VND</Text>
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
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
                <Button
                  label={bookingType === 'package' ? 'SUBSCRIBE PACKAGE' : 'CONFIRM BOOKING'}
                  onPress={handleCreate}
                  loading={creating}
                  size="lg"
                  style={{ flex: 1 }}
                />
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <BookingDateModal
        visible={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        onApply={(start, end) => {
          applyDateTime('start', start);
          applyDateTime('end', end);
        }}
        initialStart={startDateTime}
        initialEnd={endDateTime}
        isPackage={bookingType === 'package'}
        packageDuration={activePkg?.durationDays}
      />

      {/* ── Custom Dialog Modal ────────────────────────────────────────────────── */}
      <Modal visible={dialog.visible} transparent animationType="fade" onRequestClose={() => setDialog(d => ({ ...d, visible: false }))}>
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogContainer}>
            <View style={styles.dialogIconContainer}>
              {dialog.type === 'success' && <Ionicons name="checkmark-circle" size={42} color={Colors.success} />}
              {dialog.type === 'error' && <Ionicons name="alert-circle" size={42} color={Colors.error} />}
              {dialog.type === 'confirm' && <Ionicons name="warning" size={42} color={Colors.amber} />}
              {dialog.type === 'alert' && <Ionicons name="information-circle" size={42} color={Colors.primary} />}
            </View>

            <Text style={styles.dialogTitle}>{dialog.title}</Text>
            <Text style={styles.dialogMessage}>{dialog.message}</Text>

            <View style={styles.dialogActions}>
              <TouchableOpacity
                style={[
                  styles.dialogBtn,
                  dialog.type === 'confirm' ? styles.dialogBtnConfirmDanger : styles.dialogBtnConfirmPrimary
                ]}
                onPress={dialog.onConfirm}
              >
                <Text style={styles.dialogBtnConfirmText}>{dialog.confirmText || 'OK'}</Text>
              </TouchableOpacity>
              {dialog.type === 'confirm' && (
                <TouchableOpacity style={[styles.dialogBtn, styles.dialogBtnCancel]} onPress={dialog.onCancel}>
                  <Text style={styles.dialogBtnCancelText}>{dialog.cancelText || 'Cancel'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

