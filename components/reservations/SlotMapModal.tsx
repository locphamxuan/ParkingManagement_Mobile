import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { styles } from '../../styles/screens/reservations';
import type { FloorWithAvailability, SlotItem } from '../../services/floors';
import type { VehicleTypeOption } from '../../services/reservations';
import { guessVehicleCategory } from '../../utils/vehicle';
import { splitSlotsSymmetrically } from '../../utils/reservationFormat';
import { CustomDialog, useCustomDialog } from './CustomDialog';

interface SlotMapModalProps {
  visible: boolean;
  onClose: () => void;
  slots: SlotItem[];
  fetchingSlots: boolean;
  viewMode: '2D' | '3D';
  setViewMode: (mode: '2D' | '3D') => void;
  selectedFloor?: FloorWithAvailability;
  selectedSlotId: string;
  vtCategory: string | null;
  vehicleTypes: VehicleTypeOption[];
  selectedVehicleTypeId: string;
  onSelectSlot: (slot: SlotItem) => void;
}

function getSlotCategory(slot: SlotItem): 'car' | 'motorcycle' {
  const vtStr = (slot.vehicleType?.code || (typeof slot.vehicleType === 'string' ? slot.vehicleType : '')).toLowerCase();
  if (vtStr.includes('moto') || vtStr.includes('xe máy')) return 'motorcycle';
  if (vtStr.includes('car') || vtStr.includes('ô tô')) return 'car';
  
  const slotCode = slot.code.toUpperCase();
  if (slotCode.includes('MOTO') || slotCode.includes('SMW') || slotCode.includes('SMR') || slotCode.startsWith('M')) {
    return 'motorcycle';
  }
  return 'car';
}

function getSlotSymbol(slot: SlotItem): string {
  const cat = getSlotCategory(slot);
  return cat === 'car' ? '🚗' : '🏍️';
}

// Modal bản đồ bãi đỗ 2D/3D để chọn slot — tách từ reservations.tsx.
export function SlotMapModal({
  visible,
  onClose,
  slots,
  fetchingSlots,
  viewMode,
  setViewMode,
  selectedFloor,
  selectedSlotId,
  vtCategory,
  vehicleTypes,
  selectedVehicleTypeId,
  onSelectSlot,
}: SlotMapModalProps) {
  // Dialog dùng chung thay Alert.alert native (giữ tông sky-blue của app).
  const { dialog, showCustomAlert, dismissDialog } = useCustomDialog();

  const handleSlotClick = (slot: SlotItem, isSelectable: boolean, isCompatible: boolean) => {
    if (isSelectable) {
      onSelectSlot(slot);
      return;
    }
    if (!isCompatible) {
      const slotCat = getSlotCategory(slot);
      showCustomAlert(
        'Incompatible Vehicle Type',
        `Slot ${slot.code} is designated for ${slotCat === 'car' ? 'Cars 🚗' : 'Motorcycles 🏍️'}. You cannot assign a ${vtCategory === 'motorcycle' ? 'Motorcycle 🏍️' : 'Car 🚗'} package to a ${slotCat === 'car' ? 'Car 🚗' : 'Motorcycle 🏍️'} slot.`,
        undefined,
        'warning'
      );
    } else {
      showCustomAlert('Slot Occupied', `Slot ${slot.code} is currently occupied or assigned to another customer.`, undefined, 'error');
    }
  };
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.mapModalOverlay}>
        <View style={styles.mapModalSheet}>
          {/* Header */}
          <View style={styles.mapModalHeader}>
            <View>
              <Text style={styles.mapModalTitle}>Basement Parking Map</Text>
              <Text style={styles.mapModalSubtitle}>{selectedFloor?.name || 'Floor Map'}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
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

                const selectedVt = vehicleTypes.find(vt => vt._id === selectedVehicleTypeId);
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
                            const slotCat = getSlotCategory(slot);
                            const isCompatible = !vtCategory || (
                              vtCategory === 'car' ? slotCat === 'car' : slotCat === 'motorcycle'
                            );
                            const isAvailable = slot.status === 'available' && isCompatible;
                            const isSelectable = isAvailable && slot.selectable !== false && slot.reservable !== false && !slot.owner;
                            const isSelected = selectedSlotId === slot._id;
                            return (
                              <TouchableOpacity
                                key={slot._id}
                                style={[
                                  styles.slotCell2D,
                                  { width: slotWidth + 12, height: slotHeight + 12 },
                                  isSelected && styles.slotCell2DSelected,
                                  !isSelectable && styles.slotCell2DDisabled,
                                ]}
                                onPress={() => handleSlotClick(slot, isSelectable, isCompatible)}
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
                            const slotCat = getSlotCategory(slot);
                            const isCompatible = !vtCategory || (
                              vtCategory === 'car' ? slotCat === 'car' : slotCat === 'motorcycle'
                            );
                            const isAvailable = slot.status === 'available' && isCompatible;
                            const isSelectable = isAvailable && slot.selectable !== false && slot.reservable !== false && !slot.owner;
                            const isSelected = selectedSlotId === slot._id;
                            return (
                              <TouchableOpacity
                                key={slot._id}
                                style={[
                                  styles.slotCell2D,
                                  { width: slotWidth + 12, height: slotHeight + 12 },
                                  isSelected && styles.slotCell2DSelected,
                                  !isSelectable && styles.slotCell2DDisabled,
                                ]}
                                onPress={() => handleSlotClick(slot, isSelectable, isCompatible)}
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
                                const slotVtCode = slot.vehicleType?.code?.toLowerCase() || (slot.code.toUpperCase().startsWith('M') ? 'motorcycle' : 'car');
                                const isCompatible = !vtCategory || (
                                  vtCategory === 'car' ? slotVtCode === 'car' : slotVtCode === 'motorcycle'
                                );
                                const isAvailable = slot.status === 'available' && isCompatible;
                                const isSelectable = isAvailable && slot.selectable !== false && slot.reservable !== false && !slot.owner;
                                const isSelected = selectedSlotId === slot._id;

                                return (
                                  <TouchableOpacity
                                    key={slot._id}
                                    style={[styles.slot3DBoxContainer, { width: slotWidth, height: slotHeight }]}
                                    onPress={() => {
                                      if (isSelectable) {
                                        onSelectSlot(slot);
                                      } else {
                                        showOccupiedAlert();
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
                                const slotVtCode = slot.vehicleType?.code?.toLowerCase() || (slot.code.toUpperCase().startsWith('M') ? 'motorcycle' : 'car');
                                const isCompatible = !vtCategory || (
                                  vtCategory === 'car' ? slotVtCode === 'car' : slotVtCode === 'motorcycle'
                                );
                                const isAvailable = slot.status === 'available' && isCompatible;
                                const isSelectable = isAvailable && slot.selectable !== false && slot.reservable !== false && !slot.owner;
                                const isSelected = selectedSlotId === slot._id;

                                return (
                                  <TouchableOpacity
                                    key={slot._id}
                                    style={[styles.slot3DBoxContainer, { width: slotWidth, height: slotHeight }]}
                                    onPress={() => {
                                      if (isSelectable) {
                                        onSelectSlot(slot);
                                      } else {
                                        showOccupiedAlert();
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
                {selectedSlotId ? (
                  `Slot ${slots.find((s) => s._id === selectedSlotId)?.code}`
                ) : (
                  'None Selected'
                )}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.confirmSelectionBtn, !selectedSlotId && styles.confirmSelectionBtnDisabled]}
              disabled={!selectedSlotId}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmSelectionBtnText}>Confirm Selection</Text>
            </TouchableOpacity>
          </View>
        </View>
        <CustomDialog dialog={dialog} onDismiss={dismissDialog} />
      </View>
    </Modal>
  );
}
