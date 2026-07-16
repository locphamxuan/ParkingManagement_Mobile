import React, { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { listPackages, subscribe, listSubscriptions, cancelSubscription, renewSubscription } from '../services/longTerm';
import type { LongTermPackage, LongTermSubscription } from '../types';
import {
  listReservations,
  createReservation,
  cancelReservation,
  estimateFee,
  listBuildings,
  getBuildingVehicleTypes,
  getReservationPolicy,
  type FeeEstimate,
  type ReservationPolicyInfo,
} from '../services/reservations';
import type { BuildingOption, VehicleTypeOption } from '../services/reservations';
import { ApiError } from '../services/api';
import {
  getBuildingFloors,
  getFloorSlots,
} from '../services/floors';
import type { FloorWithAvailability, SlotItem } from '../services/floors';
import type { Reservation } from '../types';
import { useUIStore } from '../store/uiStore';
import { guessVehicleCategory } from '../utils/vehicle';
import {
  fmtVND, isCancelled, toWizardStr, EMPTY_WIZARD,
  type FilterStatus, type WizardStep, type WizardState,
} from '../utils/reservationFormat';
import type { Particle } from '../components/reservations/animations';
import { useCustomDialog } from '../components/reservations/CustomDialog';

// Toàn bộ state + logic của màn Reservations — tách khỏi app/(tabs)/reservations.tsx.
// Màn hình và ReservationWizard nhận lại kết quả này qua `vm`.
export function useReservations() {
  const { session } = useAuthStore();
  const token = session?.token ?? '';
  const plates = session?.licensePlates ?? [];

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [subscriptions, setSubscriptions] = useState<LongTermSubscription[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('booked');

  // Custom Alert / Confirm Dialog — state + helpers tách sang useCustomDialog.
  const { dialog, showCustomAlert, showCustomConfirm, dismissDialog } = useCustomDialog();

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

  // Policy đặt chỗ của tòa đang chọn (maxAdvanceDays/maxDurationHours…) — ràng buộc picker.
  const [policy, setPolicy] = useState<ReservationPolicyInfo | null>(null);

  useEffect(() => {
    if (!wizard.buildingId || !token) {
      setPolicy(null);
      return;
    }
    let cancelled = false;
    getReservationPolicy(token, wizard.buildingId)
      .then((p) => { if (!cancelled) setPolicy(p); })
      .catch(() => { if (!cancelled) setPolicy(null); });
    return () => { cancelled = true; };
  }, [wizard.buildingId, token]);

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
      const subData = await listSubscriptions(token).catch(() => []);
      setReservations([]);
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

  const doCancel = async (r: any) => {
    setCancellingId(r._id);
    try {
      if ((r as any).isSubscription) {
        // BE trả refundAmount/refundPercent snapshot theo ReservationPolicy của tòa.
        const result = await cancelSubscription(token, r._id);
        await load();
        const refundPct = result.refundPercent ?? 80;
        const refundAmt = result.refundAmount ?? Math.round(((r.fee ?? 0) * refundPct) / 100);
        const successMsg = `Your package subscription has been cancelled.\n\nRefunded ${fmtVND(refundAmt)} (${refundPct}%) to your wallet.`;
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

  const handleCancel = async (r: any) => {
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

      // % hoàn tiền theo ReservationPolicy của tòa (không hardcode) — lỗi thì dùng default BE 80%.
      const rawBuilding = r.rawSubscription?.building ?? r.building;
      const buildingId = typeof rawBuilding === 'string' ? rawBuilding : rawBuilding?._id;
      let refundPct = 80;
      if (buildingId) {
        try {
          refundPct = (await getReservationPolicy(token, buildingId)).refundPercent;
        } catch { /* giữ default */ }
      }

      const price = r.fee ?? 0;
      const refundAmt = Math.round((price * refundPct) / 100);
      const forfeitAmt = price - refundAmt;
      const msg = `Cancel long-term subscription for plate "${r.plateNumber}"?\n\nYou will be refunded ${fmtVND(refundAmt)} (${refundPct}% of price) to your wallet. The remaining ${fmtVND(forfeitAmt)} (${100 - refundPct}%) will be forfeited as a cancellation fee.`;

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
      const depositPct = feeEstimate?.depositPercent ?? policy?.depositPercent ?? 15;
      const depositTxt = result.depositAmount
        ? `\nDeposit paid: ${fmtVND(result.depositAmount)} (${depositPct}%)\nRemaining at checkout: ${fmtVND((result.estimatedFee ?? 0) - (result.depositAmount ?? 0))}`
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
          'This license plate has cancelled a reservation at this building within the last 24 hours. Please try again later.'
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

  return {
    // session
    plates,
    // list state
    reservations, subscriptions, refreshing, loadError, filter, setFilter,
    fromDate, setFromDate, toDate, setToDate,
    filtered, finalFiltered,
    cancellingId, renewingId, handleCancel, handleRenewSubscription,
    onRefresh,
    // dialog
    dialog, showCustomAlert, showCustomConfirm, dismissDialog,
    // wizard visibility / steps
    showWizard, openWizard, closeWizard, step, setStep,
    wizard, setWizard,
    viewMode, setViewMode,
    showMapModal, setShowMapModal,
    displaySlotCode, setDisplaySlotCode,
    showBookingModal, setShowBookingModal,
    // booking type / packages
    bookingType, setBookingType,
    selectedPackageId, setSelectedPackageId,
    packages, fetchingPackages,
    reserveDedicatedSlot, setReserveDedicatedSlot,
    summaryExpanded, setSummaryExpanded,
    particles, triggerGlitter,
    activePkg,
    // step data
    buildings, fetchingBuildings, handleSelectBuilding,
    vehicleTypes, fetchingVT,
    floors, fetchingFloors, floorsError, handleSelectFloor,
    slots, fetchingSlots,
    selectedFloor, selectedBuilding, vtCategory, eligiblePlates,
    // step 3
    startDateTime, endDateTime, applyDateTime,
    policy,
    feeEstimate, fetchingFee, estimatedFeeInfo,
    creating, createError,
    // navigation
    goToStep2, goToStep3, handleCreate,
  };
}

export type ReservationsVM = ReturnType<typeof useReservations>;
