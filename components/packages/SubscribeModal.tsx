import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { sheet } from '../../styles/screens/packages';
import { SlotMapModal } from './SlotMapModal';
import { fmtMoney } from '../../utils/packageHelpers';
import { vehicleCategoryFromVehicleType } from '../../utils/vehicle';
import type { FloorWithAvailability, SlotItem } from '../../services/floors';
import type { LongTermPackage, LicensePlate } from '../../types';

interface SubscribeModalProps {
  pkg: LongTermPackage;
  token: string;
  matchedPlates: LicensePlate[];
  selectedPlate: string;
  setSelectedPlate: (plate: string) => void;
  floors: FloorWithAvailability[];
  selectedFloorId: string;
  onSelectFloor: (floorId: string) => void;
  slots: SlotItem[];
  fetchingSlots: boolean;
  selectedSlot: SlotItem | null;
  onSelectSlot: (slot: SlotItem) => void;
  showMapModal: boolean;
  setShowMapModal: (v: boolean) => void;
  viewMode: '2D' | '3D';
  setViewMode: (v: '2D' | '3D') => void;
  purchasing: boolean;
  purchaseErr: string | null;
  purchaseSuccessMsg: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

/** Bottom-sheet: confirm subscribing to a package (plate, floor, optional fixed slot). */
export function SubscribeModal({
  pkg, token, matchedPlates, selectedPlate, setSelectedPlate,
  floors, selectedFloorId, onSelectFloor, slots, fetchingSlots,
  selectedSlot, onSelectSlot, showMapModal, setShowMapModal, viewMode, setViewMode,
  purchasing, purchaseErr, purchaseSuccessMsg, onClose, onConfirm,
}: SubscribeModalProps) {
  const isCar = vehicleCategoryFromVehicleType(pkg.vehicleType) === 'car';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 16, borderTopWidth: 1, borderColor: '#e2e8f0' }}>
          <View style={sheet.header}>
            <View>
              <Text style={sheet.headerEyebrow}>Confirm Package Subscription</Text>
              <Text style={sheet.title}>{pkg.name}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle" size={26} color={Colors.textDim} />
            </TouchableOpacity>
          </View>

          {/* Package Details */}
          <View style={sheet.infoCard}>
            <View style={sheet.infoRow}>
              <Text style={sheet.infoLabel}>Building</Text>
              <Text style={sheet.infoVal}>{pkg.building?.name || 'Building'}</Text>
            </View>
            <View style={sheet.infoRow}>
              <Text style={sheet.infoLabel}>Vehicle Type</Text>
              <Text style={[sheet.infoVal, { color: isCar ? Colors.blue : Colors.success }]}>{isCar ? 'Car' : 'Motorcycle'}</Text>
            </View>
            <View style={sheet.infoRow}>
              <Text style={sheet.infoLabel}>Duration</Text>
              <Text style={sheet.infoVal}>{pkg.durationDays} Days</Text>
            </View>
            <View style={sheet.infoRowTotal}>
              <Text style={sheet.totalLabel}>Total Price</Text>
              <Text style={sheet.totalVal}>{fmtMoney(pkg.price)}</Text>
            </View>
          </View>

          {/* Vehicle License Plate Selection */}
          <View style={{ gap: 6 }}>
            <Text style={sheet.sectionLabel}>
              Select {isCar ? 'Car' : 'Motorcycle'} License Plate:
            </Text>
            {matchedPlates.length > 0 ? (
              <View style={sheet.chipsRow}>
                {matchedPlates.map((p) => {
                  const isSel = selectedPlate === p.plateNumber;
                  return (
                    <TouchableOpacity
                      key={p.plateNumber}
                      onPress={() => setSelectedPlate(p.plateNumber)}
                      style={[sheet.chip, isSel && sheet.chipActive]}
                    >
                      <Text style={isSel ? sheet.chipTextActive : sheet.chipText}>
                        {p.plateNumber}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={sheet.warnBox}>
                <Text style={sheet.warnBoxText}>
                  You don't have any registered {isCar ? 'Car' : 'Motorcycle'} license plates in your account. Please add a vehicle plate in Profile first.
                </Text>
              </View>
            )}
          </View>

          {/* Floor Selection */}
          {floors.length > 0 && (
            <View style={{ gap: 6 }}>
              <Text style={sheet.sectionLabel}>Select Floor:</Text>
              <View style={sheet.chipsRow}>
                {floors.map((f) => {
                  const isSel = selectedFloorId === f._id;
                  return (
                    <TouchableOpacity
                      key={f._id}
                      onPress={() => onSelectFloor(f._id)}
                      style={[sheet.chip, isSel && sheet.chipActive]}
                    >
                      <Text style={isSel ? sheet.chipTextActive : sheet.chipText}>{f.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Optional fixed-slot selection (omit it for assignment at check-in). */}
          <View style={{ gap: 6 }}>
            <Text style={sheet.sectionLabel}>Optional Fixed Slot:</Text>
            {selectedSlot ? (
              <View style={sheet.slotChosenRow}>
                <View style={sheet.slotChosenInfo}>
                  <Ionicons name="checkmark-circle" size={20} color="#166534" />
                  <View>
                    <Text style={sheet.slotChosenCode}>Slot {selectedSlot.code}</Text>
                    <Text style={sheet.slotChosenSub}>Reserved Exclusively for {selectedPlate || 'your vehicle'}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setShowMapModal(true)} style={sheet.slotChangeBtn}>
                  <Text style={sheet.slotChangeBtnText}>Change Spot</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => setShowMapModal(true)} style={sheet.slotPickBtn}>
                <Ionicons name="map-outline" size={18} color={Colors.primary} />
                <Text style={sheet.slotPickBtnText}>Pick a fixed slot (optional)</Text>
              </TouchableOpacity>
            )}
            {!selectedSlot ? (
              <Text style={sheet.bodyText}>
                Skip this step to have staff assign an available slot when you check in.
              </Text>
            ) : null}
          </View>

          {/* Interactive Map Picker Modal */}
          {showMapModal && (
            <SlotMapModal
              visible={showMapModal}
              onClose={() => setShowMapModal(false)}
              slots={slots}
              fetchingSlots={fetchingSlots}
              viewMode={viewMode}
              setViewMode={setViewMode}
              selectedFloor={floors.find((f) => f._id === selectedFloorId) || {
                _id: selectedFloorId,
                name: 'Floor',
                code: 'FL',
                allowedVehicleTypes: [],
                availableSlots: 0,
                occupiedSlots: 0,
                reservedSlots: 0,
                totalSlots: 0,
              }}
              selectedSlotId={selectedSlot?._id || ''}
              vtCategory={isCar ? 'car' : 'motorcycle'}
              onSelectSlot={(slot) => {
                onSelectSlot(slot);
                setShowMapModal(false);
              }}
            />
          )}

          {/* Status / Error messages */}
          {purchaseErr && (
            <View style={sheet.errorBoxSharp}>
              <Text style={sheet.errorBoxSharpText}>{purchaseErr}</Text>
            </View>
          )}

          {purchaseSuccessMsg && (
            <View style={sheet.successBox}>
              <Text style={sheet.successBoxText}>{purchaseSuccessMsg}</Text>
            </View>
          )}

          {/* Action buttons */}
          <View style={sheet.actionsRow}>
            <TouchableOpacity onPress={onClose} style={sheet.secondaryBtn}>
              <Text style={sheet.secondaryBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              disabled={purchasing || !selectedPlate || matchedPlates.length === 0}
              style={[sheet.primaryBtn, (purchasing || !selectedPlate || matchedPlates.length === 0) && sheet.primaryBtnDisabled]}
            >
              <Text style={sheet.primaryBtnText}>
                {purchasing ? 'Processing...' : 'Confirm Subscription'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
