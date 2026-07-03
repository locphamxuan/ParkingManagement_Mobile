import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../constants/theme';
import { styles } from '../../styles/screens/reservations';
import { SlotMapModal } from './SlotMapModal';
import type { ReservationsVM } from '../../hooks/useReservations';

// Step 2 wizard — chọn tầng + ô đỗ (qua bản đồ 2D/3D). Gói không bắt buộc chọn ô.
export function WizardStep2({ vm }: { vm: ReservationsVM }) {
  const {
    wizard, setWizard,
    viewMode, setViewMode,
    showMapModal, setShowMapModal,
    displaySlotCode, setDisplaySlotCode,
    bookingType,
    reserveDedicatedSlot, setReserveDedicatedSlot,
    vehicleTypes,
    floors, fetchingFloors, floorsError, handleSelectFloor,
    slots, fetchingSlots,
    selectedFloor, vtCategory,
  } = vm;

  return (
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
                <SlotMapModal
                  visible={showMapModal}
                  onClose={() => setShowMapModal(false)}
                  slots={slots}
                  fetchingSlots={fetchingSlots}
                  viewMode={viewMode}
                  setViewMode={setViewMode}
                  selectedFloor={selectedFloor}
                  selectedSlotId={wizard.slotId}
                  vtCategory={vtCategory}
                  vehicleTypes={vehicleTypes}
                  selectedVehicleTypeId={wizard.vehicleTypeId}
                  onSelectSlot={(slot) => {
                    setWizard((p) => ({ ...p, slotId: slot._id }));
                    setDisplaySlotCode(slot.code);
                  }}
                />
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}
