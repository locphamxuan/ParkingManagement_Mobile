import { useRef, useState } from 'react';
import { subscribe } from '../services/longTerm';
import { getBuildingFloors, getFloorSlots, type FloorWithAvailability, type SlotItem } from '../services/floors';
import { vtCode } from '../utils/packageHelpers';
import { vehicleCategoryFromPlate, vehicleCategoryFromVehicleType } from '../utils/vehicle';
import { isSlotSelectionError, resolveSubscriptionErrorMessage } from '../utils/apiErrors';
import type { LongTermPackage, LicensePlate } from '../types';

interface UsePackageSubscriptionParams {
  token: string;
  plates: LicensePlate[];
  /** Pre-filled from ?plateNumber= query param (package CTA / notification tap), used as the
   * default selection when it matches the package's vehicle category. */
  prefillPlateNumber?: string;
  onSubscribed: () => void;
}

/**
 * State + handlers for the "Subscribe to package" bottom sheet (plate pick, floor pick,
 * optional fixed-slot map, purchase). Tách khỏi packages.tsx để component chỉ giữ JSX.
 */
export function usePackageSubscription({ token, plates, prefillPlateNumber, onSubscribed }: UsePackageSubscriptionParams) {
  const [selectedPkg, setSelectedPkg] = useState<LongTermPackage | null>(null);
  const [selectedPlate, setSelectedPlate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('2D');
  const [floors, setFloors] = useState<FloorWithAvailability[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [fetchingSlots, setFetchingSlots] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseErr, setPurchaseErr] = useState<string | null>(null);
  const [purchaseSuccessMsg, setPurchaseSuccessMsg] = useState<string | null>(null);
  const loadRequestId = useRef(0);

  const isCarPackage = (pkg: LongTermPackage) => {
    return vehicleCategoryFromVehicleType(
      typeof pkg.vehicleType === 'string'
        ? pkg.vehicleType
        : { code: vtCode(pkg.vehicleType) || undefined, name: pkg.vehicleType?.name },
    ) === 'car';
  };

  const matchedPlatesFor = (pkg: LongTermPackage) => {
    const isCar = isCarPackage(pkg);
    return plates.filter((p) =>
      vehicleCategoryFromPlate(p.vehicleType) === (isCar ? 'car' : 'motorcycle'),
    );
  };

  const closeModal = () => {
    loadRequestId.current += 1;
    setSelectedPkg(null);
    setSelectedPlate('');
    setSelectedSlot(null);
    setShowMapModal(false);
    setFloors([]);
    setSelectedFloorId('');
    setSlots([]);
    setFetchingSlots(false);
    setPurchaseErr(null);
    setPurchaseSuccessMsg(null);
  };

  const packageVehicleTypeId = (pkg: LongTermPackage) => {
    const vehicleType = pkg.vehicleType;
    return typeof vehicleType === 'string'
      ? vehicleType
      : String(vehicleType?._id || '');
  };

  const handleOpenSubscribe = async (pkg: LongTermPackage) => {
    const requestId = ++loadRequestId.current;
    setSelectedPkg(pkg);
    setSelectedSlot(null);
    setShowMapModal(false);
    setFloors([]);
    setSelectedFloorId('');
    setSlots([]);
    setPurchaseErr(null);
    setPurchaseSuccessMsg(null);
    const matched = matchedPlatesFor(pkg);
    // Prefer the plate pre-filled from the package CTA / notification tap when it matches
    // this package's vehicle category; otherwise fall back to the first match.
    const prefillMatch = prefillPlateNumber
      ? matched.find((p) => p.plateNumber === prefillPlateNumber)
      : undefined;
    setSelectedPlate(prefillMatch?.plateNumber || matched[0]?.plateNumber || '');

    const bldId = pkg.building?._id || '';
    if (bldId && token) {
      setFetchingSlots(true);
      try {
        const pkgVtId = packageVehicleTypeId(pkg);
        const flList = await getBuildingFloors(token, bldId, pkgVtId);
        const isCar = isCarPackage(pkg);

        // Filter floors that allow this vehicleType (or have empty allowedVehicleTypes meaning all allowed)
        const compatibleFloors = flList.filter((f) => {
          if (!f.allowedVehicleTypes || f.allowedVehicleTypes.length === 0) return true;
          return f.allowedVehicleTypes.some((vt) => {
            const vtId = typeof vt === 'object' ? vt._id : String(vt);
            const vtNameOrCode = (typeof vt === 'object' ? (vt.code || vt.name) : String(vt)).toLowerCase();
            if (pkgVtId && vtId === pkgVtId) return true;
            if (isCar) {
              return /car|oto|ô t|auto/i.test(vtNameOrCode);
            } else {
              return /motor|xe|máy|bike|moto/i.test(vtNameOrCode);
            }
          });
        });

        if (requestId !== loadRequestId.current) return;
        setFloors(compatibleFloors);

        if (compatibleFloors.length > 0) {
          setSelectedFloorId(compatibleFloors[0]._id);
          const slList = await getFloorSlots(
            token,
            bldId,
            compatibleFloors[0]._id,
            'subscriber',
            pkgVtId,
          );
          if (requestId !== loadRequestId.current) return;
          setSlots(slList);
        } else {
          setSelectedFloorId('');
          setSlots([]);
        }
      } catch {
        if (requestId !== loadRequestId.current) return;
        setFloors([]);
        setSelectedFloorId('');
        setSlots([]);
        setPurchaseErr(
          'Optional fixed slots could not be loaded. You can continue without selecting one.',
        );
      } finally {
        if (requestId === loadRequestId.current) setFetchingSlots(false);
      }
    }
  };

  const handleSelectFloor = async (floorId: string) => {
    if (!selectedPkg) return;
    const requestId = ++loadRequestId.current;
    setSelectedFloorId(floorId);
    setSelectedSlot(null);
    setSlots([]);
    setPurchaseErr(null);
    setFetchingSlots(true);
    try {
      const slList = await getFloorSlots(
        token,
        selectedPkg.building?._id || '',
        floorId,
        'subscriber',
        packageVehicleTypeId(selectedPkg),
      );
      if (requestId === loadRequestId.current) setSlots(slList);
    } catch {
      if (requestId === loadRequestId.current) {
        setSlots([]);
        setPurchaseErr(
          'Slots for this floor could not be loaded. Try again or continue without a fixed slot.',
        );
      }
    } finally {
      if (requestId === loadRequestId.current) setFetchingSlots(false);
    }
  };

  const handleConfirmSubscribe = async () => {
    if (!selectedPkg || !selectedPlate) return;
    setPurchasing(true);
    setPurchaseErr(null);
    try {
      await subscribe(
        token,
        selectedPkg._id,
        selectedPlate,
        selectedPkg.building?._id || '',
        selectedSlot?._id || undefined,
      );
      setPurchaseSuccessMsg(
        selectedSlot
          ? `Successfully subscribed and reserved slot ${selectedSlot.code}!`
          : 'Successfully subscribed! A parking slot will be assigned at check-in.',
      );
      setTimeout(() => {
        closeModal();
        onSubscribed();
      }, 1200);
    } catch (err) {
      setPurchaseErr(resolveSubscriptionErrorMessage(err));
      if (isSlotSelectionError(err)) {
        const requestId = ++loadRequestId.current;
        setSelectedSlot(null);
        setShowMapModal(false);
        setFetchingSlots(true);
        try {
          const refreshed = await getFloorSlots(
            token,
            selectedPkg.building?._id || '',
            selectedFloorId,
            'subscriber',
            packageVehicleTypeId(selectedPkg),
          );
          if (requestId === loadRequestId.current) setSlots(refreshed);
        } catch {
          if (requestId === loadRequestId.current) setSlots([]);
        } finally {
          if (requestId === loadRequestId.current) setFetchingSlots(false);
        }
      }
    } finally {
      setPurchasing(false);
    }
  };

  return {
    selectedPkg, selectedPlate, setSelectedPlate, selectedSlot, setSelectedSlot,
    showMapModal, setShowMapModal, viewMode, setViewMode,
    floors, selectedFloorId, slots, fetchingSlots,
    purchasing, purchaseErr, purchaseSuccessMsg,
    isCarPackage, matchedPlatesFor,
    handleOpenSubscribe, handleSelectFloor, handleConfirmSubscribe, closeModal,
  };
}
