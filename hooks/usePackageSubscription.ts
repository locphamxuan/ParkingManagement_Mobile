import { useState } from 'react';
import { subscribe } from '../services/longTerm';
import { getBuildingFloors, getFloorSlots, type FloorWithAvailability, type SlotItem } from '../services/floors';
import { vtCode } from '../utils/packageHelpers';
import type { LongTermPackage, LicensePlate } from '../types';

interface UsePackageSubscriptionParams {
  token: string;
  plates: LicensePlate[];
  /** Pre-filled from ?plateNumber= query param (Book Now / notification tap), used as the
   * default selection when it matches the package's vehicle category. */
  prefillPlateNumber?: string;
  onSubscribed: () => void;
}

/**
 * State + handlers for the "Subscribe to package" bottom sheet (plate pick, floor pick,
 * dedicated slot map, purchase). Tách khỏi packages.tsx để component chỉ giữ JSX.
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

  const isCarPackage = (pkg: LongTermPackage) => {
    const code = vtCode(pkg.vehicleType) || '';
    return code.toLowerCase().includes('car') || (typeof pkg.vehicleType === 'string' && pkg.vehicleType.toLowerCase().includes('car'));
  };

  const matchedPlatesFor = (pkg: LongTermPackage) => {
    const isCar = isCarPackage(pkg);
    return plates.filter((p) =>
      isCar ? (p.vehicleType === 'car' || p.vehicleType?.toLowerCase().includes('car'))
        : (p.vehicleType === 'motorcycle' || p.vehicleType?.toLowerCase().includes('moto')),
    );
  };

  const closeModal = () => {
    setSelectedPkg(null);
    setSelectedSlot(null);
    setPurchaseErr(null);
    setPurchaseSuccessMsg(null);
  };

  const handleOpenSubscribe = async (pkg: LongTermPackage) => {
    setSelectedPkg(pkg);
    setSelectedSlot(null);
    setPurchaseErr(null);
    setPurchaseSuccessMsg(null);
    const matched = matchedPlatesFor(pkg);
    // Prefer the plate pre-filled from Book Now / notification tap when it matches
    // this package's vehicle category; otherwise fall back to the first match.
    const prefillMatch = prefillPlateNumber
      ? matched.find((p) => p.plateNumber === prefillPlateNumber)
      : undefined;
    setSelectedPlate(prefillMatch?.plateNumber || matched[0]?.plateNumber || '');

    const bldId = pkg.building?._id || '';
    if (bldId && token) {
      try {
        const pkgVtId = String(typeof pkg.vehicleType === 'object' && pkg.vehicleType ? pkg.vehicleType._id : pkg.vehicleType);
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

        setFloors(compatibleFloors);

        if (compatibleFloors.length > 0) {
          setSelectedFloorId(compatibleFloors[0]._id);
          const slList = await getFloorSlots(token, bldId, compatibleFloors[0]._id, 'subscriber');
          setSlots(slList);
        } else {
          setSelectedFloorId('');
          setSlots([]);
        }
      } catch {
        // best-effort prefill; user can still subscribe without a dedicated slot
      }
    }
  };

  const handleSelectFloor = async (floorId: string) => {
    if (!selectedPkg) return;
    setSelectedFloorId(floorId);
    setSelectedSlot(null);
    setFetchingSlots(true);
    try {
      const slList = await getFloorSlots(token, selectedPkg.building?._id || '', floorId, 'subscriber');
      setSlots(slList);
    } catch {
      // keep previous slots on failure
    }
    setFetchingSlots(false);
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
      setPurchaseSuccessMsg('Successfully subscribed & locked your dedicated slot!');
      setTimeout(() => {
        closeModal();
        onSubscribed();
      }, 1200);
    } catch (err) {
      setPurchaseErr(err instanceof Error ? err.message : 'Subscription failed. Please check your wallet balance.');
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
