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
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Colors } from '../../constants/theme';
import { styles } from '../../styles/screens/reservations';
import type { FloorWithAvailability, SlotItem } from '../../services/floors';
import { splitSlotsSymmetrically } from '../../utils/reservationFormat';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

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
  onSelectSlot: (slot: SlotItem) => void;
}

interface InteractiveParkingDeckProps {
  topRowSlots: SlotItem[];
  bottomRowSlots: SlotItem[];
  selectedSlotId: string;
  slotHeight: number;
  fontSize: number;
  vehicleIcon: IoniconName;
  onSelectSlot: (slot: SlotItem) => void;
}

function clamp(value: number, minimum: number, maximum: number) {
  'worklet';
  return Math.min(Math.max(value, minimum), maximum);
}

function InteractiveParkingDeck({
  topRowSlots,
  bottomRowSlots,
  selectedSlotId,
  slotHeight,
  fontSize,
  vehicleIcon,
  onSelectSlot,
}: InteractiveParkingDeckProps) {
  const scale = useSharedValue(1);
  const scaleAtGestureStart = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const translateXAtGestureStart = useSharedValue(0);
  const translateYAtGestureStart = useSharedValue(0);

  const resetView = () => {
    scale.value = withTiming(1, { duration: 180 });
    translateX.value = withTiming(0, { duration: 180 });
    translateY.value = withTiming(0, { duration: 180 });
  };

  const zoomBy = (amount: number) => {
    const nextScale = clamp(scale.value + amount, 1, 2.4);
    const maxX = (nextScale - 1) * 110;
    const maxY = (nextScale - 1) * 150;
    scale.value = withTiming(nextScale, { duration: 160 });
    translateX.value = withTiming(clamp(translateX.value, -maxX, maxX), { duration: 160 });
    translateY.value = withTiming(clamp(translateY.value, -maxY, maxY), { duration: 160 });
  };

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      scaleAtGestureStart.value = scale.value;
    })
    .onUpdate((event) => {
      const nextScale = clamp(scaleAtGestureStart.value * event.scale, 1, 2.4);
      scale.value = nextScale;
      const maxX = (nextScale - 1) * 110;
      const maxY = (nextScale - 1) * 150;
      translateX.value = clamp(translateX.value, -maxX, maxX);
      translateY.value = clamp(translateY.value, -maxY, maxY);
    });

  const panGesture = Gesture.Pan()
    .minDistance(8)
    .averageTouches(true)
    .onBegin(() => {
      translateXAtGestureStart.value = translateX.value;
      translateYAtGestureStart.value = translateY.value;
    })
    .onUpdate((event) => {
      if (scale.value <= 1) return;
      const maxX = (scale.value - 1) * 110;
      const maxY = (scale.value - 1) * 150;
      translateX.value = clamp(translateXAtGestureStart.value + event.translationX, -maxX, maxX);
      translateY.value = clamp(translateYAtGestureStart.value + event.translationY, -maxY, maxY);
    });

  const deckAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const renderSlot = (slot: SlotItem) => {
    const isSelected = selectedSlotId === slot._id;
    const isAvailable = !slot.status || slot.status.toLowerCase() === 'available';
    return (
      <TouchableOpacity
        key={slot._id}
        disabled={!isAvailable && !isSelected}
        style={[styles.slot3DBoxContainer, { height: slotHeight + 8 }, !isAvailable && !isSelected && styles.slot3DBoxDisabled]}
        onPress={() => isAvailable && onSelectSlot(slot)}
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityLabel={`${slot.code}, ${isSelected ? 'selected' : isAvailable ? 'available' : 'occupied'}`}
        accessibilityState={{ selected: isSelected, disabled: !isAvailable && !isSelected }}
      >
        <View style={[styles.slot3DBase, isSelected && styles.slot3DBaseSelected, !isAvailable && !isSelected && styles.slot3DBaseDisabled]} />
        <View style={[styles.slot3DSurface, isSelected && styles.slot3DSurfaceSelected, !isAvailable && !isSelected && styles.slot3DSurfaceDisabled]}>
          <Text style={[styles.codeText3D, { fontSize }]}>{slot.code}</Text>
          <Ionicons name={vehicleIcon} size={14} color={isAvailable ? Colors.textMuted : Colors.textDim} style={{ marginTop: 2 }} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.map3DInteractiveArea}>
      <View style={styles.map3DToolbar}>
      <View style={styles.map3DGestureHint} pointerEvents="none">
        <Ionicons name="expand-outline" size={13} color={Colors.textDim} />
        <Text style={styles.map3DGestureHintText}>Use two fingers to zoom</Text>
      </View>
      <View style={styles.map3DControls}>
        <TouchableOpacity style={styles.map3DControlButton} onPress={() => zoomBy(0.3)} accessibilityRole="button" accessibilityLabel="Zoom in">
          <Ionicons name="add" size={19} color={Colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.map3DControlButton} onPress={() => zoomBy(-0.3)} accessibilityRole="button" accessibilityLabel="Zoom out">
          <Ionicons name="remove" size={19} color={Colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.map3DControlButton} onPress={resetView} accessibilityRole="button" accessibilityLabel="Reset parking map view">
          <Ionicons name="scan-outline" size={17} color={Colors.primary} />
        </TouchableOpacity>
      </View>
      </View>
      <View style={styles.map3DCanvasViewport}>
      <GestureDetector gesture={Gesture.Simultaneous(pinchGesture, panGesture)}>
        <Animated.View style={[styles.isometricCanvas, deckAnimatedStyle]}>
          <View style={styles.deckGlow} />
          <View style={styles.deckTopEdge} />
          <View style={styles.deckBottomEdge} />
          <View style={styles.basementLanesRow}>
            <View style={styles.parkingLane3D}>{bottomRowSlots.map(renderSlot)}</View>
            <View style={styles.drivewayLine3D}>
              <Ionicons name="arrow-up" size={14} color="#fbbf24" />
              <View style={styles.dashedDivider} />
              <Ionicons name="arrow-down" size={14} color="#fbbf24" />
            </View>
            <View style={styles.parkingLane3D}>{topRowSlots.map(renderSlot)}</View>
          </View>
        </Animated.View>
      </GestureDetector>
      </View>
    </View>
  );
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
  onSelectSlot,
}: SlotMapModalProps) {
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
              <Text style={styles.mapModalTitle}>PARKING SLOT MAP</Text>
              <Text style={styles.mapModalSubtitle}>
                {selectedFloor?.name ? `${selectedFloor.name} — ${vtCategory === 'car' ? 'Car Slot' : 'Motorcycle Slot'}` : 'Floor Parking Map'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close parking slot map"
              hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            >
              <Ionicons name="close-circle" size={28} color={Colors.textDim} />
            </TouchableOpacity>
          </View>

          {/* View Mode Toggle */}
          <View style={styles.mapToggleRow}>
            <Text style={styles.mapSelectHint}>Tap a slot to select a position</Text>
            <View style={styles.toggleBtnGroup}>
              <TouchableOpacity
                style={[styles.toggleBtn, viewMode === '2D' && styles.toggleBtnActive]}
                onPress={() => setViewMode('2D')}
                accessibilityRole="tab"
                accessibilityState={{ selected: viewMode === '2D' }}
                accessibilityLabel="2D grid view"
              >
                <Ionicons name="grid-outline" size={14} color={viewMode === '2D' ? '#fff' : Colors.textMuted} />
                <Text style={[styles.toggleBtnText, viewMode === '2D' && { color: '#fff' }]}>2D Grid</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, viewMode === '3D' && styles.toggleBtnActive]}
                onPress={() => setViewMode('3D')}
                accessibilityRole="tab"
                accessibilityState={{ selected: viewMode === '3D' }}
                accessibilityLabel="3D parking view"
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
              <View style={[styles.legendDot2D, { borderColor: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.2)' }]} />
              <Text style={styles.legendText2D}>Selected</Text>
            </View>
            <View style={styles.legendItem2D}>
              <View style={[styles.legendDot2D, { borderColor: 'rgba(255,255,255,0.25)', borderStyle: 'dashed', backgroundColor: 'transparent' }]} />
              <Text style={styles.legendText2D}>Occupied / Locked</Text>
            </View>
          </View>

          {/* Map Content */}
          <View style={styles.mapModalContent}>
            {fetchingSlots ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 40 }} />
            ) : (() => {
              // Strictly filter slots by vehicle type matching the package (Car vs Motorcycle)
              const filteredSlots = slots.filter((slot) => {
                if (!vtCategory) return true;
                const slotCat = getSlotCategory(slot);
                return vtCategory === 'car' ? slotCat === 'car' : slotCat === 'motorcycle';
              });

              if (filteredSlots.length === 0) {
                return (
                  <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                    <Text style={styles.hintText}>No {vtCategory === 'car' ? 'car' : 'motorcycle'} parking slots on this floor.</Text>
                  </View>
                );
              }

              const slotCount = filteredSlots.length;
              let slotWidth = 55;
              let slotHeight = 45;
              let gapVal = 8;
              if (slotCount < 10) {
                slotWidth = 85;
                slotHeight = 65;
                gapVal = 12;
              } else if (slotCount <= 20) {
                slotWidth = 70;
                slotHeight = 55;
                gapVal = 10;
              }
              const fontSize3D = slotWidth < 60 ? 9 : 11;

              const { topRowSlots, bottomRowSlots } = splitSlotsSymmetrically(filteredSlots);
              const vehicleIcon: IoniconName = vtCategory === 'car' ? 'car' : 'bicycle';

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
                        {/* ROW HEADER FOR CAR SLOTS */}
                        <View style={styles.rowHeaderRow2D}>
                          <Text style={styles.rowHeader2D}>
                            {vtCategory === 'car' ? 'CAR PARKING ROW' : 'MOTORCYCLE PARKING ROW'}
                          </Text>
                        </View>
                        <View style={styles.parkingLane2D}>
                          {topRowSlots.map((slot) => {
                            const isAvailable = !slot.status || slot.status.toLowerCase() === 'available';
                            const isSelected = selectedSlotId === slot._id;
                            return (
                              <TouchableOpacity
                                key={slot._id}
                                disabled={!isAvailable && !isSelected}
                                style={[
                                  styles.slotCell2D,
                                  { width: slotWidth + 12, height: slotHeight + 12, flexDirection: 'column', justifyContent: 'center', alignItems: 'center' },
                                  isSelected && styles.slotCell2DSelected,
                                  !isAvailable && !isSelected && styles.slotCell2DDisabled,
                                ]}
                                onPress={() => isAvailable && onSelectSlot(slot)}
                                activeOpacity={0.8}
                              >
                                <Text style={[styles.slotCode2D, isSelected && styles.slotCode2DSelected, !isAvailable && { color: '#64748b' }]}>
                                  {slot.code}
                                </Text>
                                <Ionicons name={vehicleIcon} size={16} color={Colors.textMuted} style={{ marginTop: 2 }} />
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

                        {bottomRowSlots.length > 0 && (
                          <View style={styles.parkingLane2D}>
                            {bottomRowSlots.map((slot) => {
                              const isAvailable = !slot.status || slot.status.toLowerCase() === 'available';
                              const isSelected = selectedSlotId === slot._id;
                              return (
                                <TouchableOpacity
                                  key={slot._id}
                                  disabled={!isAvailable && !isSelected}
                                  style={[
                                    styles.slotCell2D,
                                    { width: slotWidth + 12, height: slotHeight + 12, flexDirection: 'column', justifyContent: 'center', alignItems: 'center' },
                                    isSelected && styles.slotCell2DSelected,
                                    !isAvailable && !isSelected && styles.slotCell2DDisabled,
                                  ]}
                                  onPress={() => isAvailable && onSelectSlot(slot)}
                                  activeOpacity={0.8}
                                >
                                  <Text style={[styles.slotCode2D, isSelected && styles.slotCode2DSelected, !isAvailable && { color: '#64748b' }]}>
                                    {slot.code}
                                  </Text>
                                  <Ionicons name={vehicleIcon} size={16} color={Colors.textMuted} style={{ marginTop: 2 }} />
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    </ScrollView>
                  </ScrollView>
                );
              } else {
                return (
                  <ScrollView
                    style={styles.map3DScroll}
                    contentContainerStyle={styles.map3DViewport}
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={styles.basement3DContainer}>
                      <InteractiveParkingDeck
                        topRowSlots={topRowSlots}
                        bottomRowSlots={bottomRowSlots}
                        selectedSlotId={selectedSlotId}
                        slotHeight={slotHeight}
                        fontSize={fontSize3D}
                        vehicleIcon={vehicleIcon}
                        onSelectSlot={onSelectSlot}
                      />
                    </View>
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
      </View>
    </Modal>
  );
}
