import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { listBuildings, getBuildingVehicleTypes, type BuildingOption, type VehicleTypeOption } from '../services/reservations';
import { getBuildingFloors, getFloorSlots, type FloorWithAvailability, type SlotItem } from '../services/floors';
import { Colors, FontSize, Radius, Spacing } from '../constants/theme';
import type { LicensePlate } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function isBuildingOpen(building: BuildingOption): boolean {
  // Assuming active buildings are open
  return true; 
}

function addressText(building: BuildingOption): string {
  if (!building.address) return 'Chưa cập nhật địa chỉ';
  if (typeof building.address === 'string') return building.address;
  return building.address.fullAddress || 'Chưa cập nhật địa chỉ';
}

function guessVehicleCategory(name: string): 'car' | 'motorcycle' {
  const n = (name || '').toLowerCase();
  if (/motor|xe|máy|bike|moto/i.test(n)) return 'motorcycle';
  return 'car';
}

function plateMatchesVehicleTypes(plate: LicensePlate, vtypes: VehicleTypeOption[]): boolean {
  if (vtypes.length === 0) return true;
  const t = plate.vehicleType?.toLowerCase() ?? '';
  return vtypes.some((vt) => {
    const c = (vt.code || vt.name || '').toLowerCase();
    if (t === 'motorcycle' || t === 'bike') return /motor|xe|máy|bike|moto/i.test(c);
    return /car|oto|ô t|auto/i.test(c);
  });
}

export default function BuildingsScreen() {
  const router = useRouter();
  const { session } = useAuthStore();
  const token = session?.token ?? '';

  // Data fetching states
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected Building states
  const [selectedId, setSelectedId] = useState<string>('');
  const [floors, setFloors] = useState<FloorWithAvailability[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleTypeOption[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Accordion state for floor slots
  const [expandedFloorId, setExpandedFloorId] = useState<string>('');
  const [floorSlots, setFloorSlots] = useState<Record<string, SlotItem[]>>({});
  const [slotsLoading, setSlotsLoading] = useState<Record<string, boolean>>({});

  // License plate states
  const [selectedPlate, setSelectedPlate] = useState<string>('');
  const [showPlateModal, setShowPlateModal] = useState(false);

  // Fetch initial building list
  useEffect(() => {
    let active = true;
    const fetchBuildings = async () => {
      if (!token) return;
      try {
        setIsLoading(true);
        const data = await listBuildings(token);
        if (active) setBuildings(data);
      } catch (err) {
        console.error('Failed to list buildings:', err);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    fetchBuildings();
    return () => {
      active = false;
    };
  }, [token]);

  // Filter building list locally
  const filteredBuildings = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return buildings;
    return buildings.filter((b) => {
      const nameMatch = b.name?.toLowerCase().includes(query);
      const codeMatch = b.code?.toLowerCase().includes(query);
      const addrMatch = addressText(b).toLowerCase().includes(query);
      return nameMatch || codeMatch || addrMatch;
    });
  }, [buildings, searchQuery]);

  const selectedBuilding = useMemo(() => {
    return buildings.find((b) => b._id === selectedId) || null;
  }, [buildings, selectedId]);

  // Fetch building details (floors + vehicle types) when selected building changes
  useEffect(() => {
    if (!selectedId || !token) {
      setFloors([]);
      setVehicleTypes([]);
      setExpandedFloorId('');
      setFloorSlots({});
      return;
    }

    let active = true;
    const fetchDetails = async () => {
      try {
        setDetailLoading(true);
        const [floorsData, vtypesData] = await Promise.all([
          getBuildingFloors(token, selectedId),
          getBuildingVehicleTypes(token, selectedId),
        ]);
        if (active) {
          setFloors(floorsData);
          setVehicleTypes(vtypesData);
        }
      } catch (err) {
        console.error('Failed to fetch building details:', err);
      } finally {
        if (active) setDetailLoading(false);
      }
    };

    fetchDetails();
    return () => {
      active = false;
    };
  }, [selectedId, token]);

  // User plates mapped & filtered
  const userPlates = useMemo(() => {
    return session?.licensePlates || [];
  }, [session]);

  const compatiblePlates = useMemo(() => {
    if (vehicleTypes.length === 0) return userPlates;
    return userPlates.filter((plate) => plateMatchesVehicleTypes(plate, vehicleTypes));
  }, [userPlates, vehicleTypes]);

  // Auto-select default plate
  useEffect(() => {
    if (compatiblePlates.length > 0) {
      const defaultPlate = compatiblePlates.find((p) => p.isDefault);
      setSelectedPlate(defaultPlate?.plateNumber || compatiblePlates[0].plateNumber);
    } else {
      setSelectedPlate('');
    }
  }, [compatiblePlates]);

  // Reset selected plate on building change
  useEffect(() => {
    setSelectedPlate('');
  }, [selectedId]);

  // Fetch slots for expanded floor
  const toggleFloorSlots = async (floorId: string) => {
    if (expandedFloorId === floorId) {
      setExpandedFloorId('');
      return;
    }

    setExpandedFloorId(floorId);

    if (floorSlots[floorId]) {
      // Already fetched
      return;
    }

    try {
      setSlotsLoading((prev) => ({ ...prev, [floorId]: true }));
      const slotsData = await getFloorSlots(token, selectedId, floorId);
      setFloorSlots((prev) => ({ ...prev, [floorId]: slotsData }));
    } catch (err) {
      console.error('Failed to get slots for floor:', floorId, err);
      Alert.alert('Lỗi', 'Không thể tải sơ đồ ô đỗ.');
    } finally {
      setSlotsLoading((prev) => ({ ...prev, [floorId]: false }));
    }
  };

  const totalSlots = useMemo(() => {
    return floors.reduce((sum, f) => sum + (f.totalSlots || 0), 0);
  }, [floors]);

  const availableSlots = useMemo(() => {
    return floors.reduce((sum, f) => sum + (f.availableSlots || 0), 0);
  }, [floors]);

  const canProceed = Boolean(selectedBuilding && selectedPlate);

  const handleBookingRedirect = () => {
    if (!canProceed || !selectedBuilding) return;
    router.push({
      pathname: '/(tabs)/reservations',
      params: {
        buildingId: selectedBuilding._id,
        plateNumber: selectedPlate,
      },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (selectedId) {
              setSelectedId(''); // Return to list view
            } else {
              router.back();
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {selectedBuilding ? selectedBuilding.name : 'Bãi Đỗ Xe'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {!selectedId ? (
        /* ─── LIST VIEW ─── */
        <View style={{ flex: 1 }}>
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={Colors.textDim} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Tìm theo tên hoặc địa chỉ..."
              placeholderTextColor={Colors.textDim}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close" size={20} color={Colors.textDim} />
              </TouchableOpacity>
            ) : null}
          </View>

          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Đang tải danh sách tòa nhà...</Text>
            </View>
          ) : filteredBuildings.length === 0 ? (
            <View style={styles.centered}>
              <Ionicons name="business" size={48} color={Colors.textDim} />
              <Text style={styles.emptyText}>Không tìm thấy tòa nhà nào</Text>
            </View>
          ) : (
            <FlatList
              data={filteredBuildings}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                return (
                  <TouchableOpacity
                    style={styles.buildingCard}
                    onPress={() => setSelectedId(item._id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.buildingCode}>{item.code || 'BUILDING'}</Text>
                        <Text style={styles.buildingName}>{item.name}</Text>
                      </View>
                      <View style={styles.statusBadge}>
                        <View style={styles.statusDot} />
                        <Text style={styles.statusText}>Hoạt động</Text>
                      </View>
                    </View>
                    <View style={styles.cardFooter}>
                      <Ionicons name="location" size={14} color={Colors.primary} style={{ marginRight: 6 }} />
                      <Text style={styles.cardAddress} numberOfLines={1}>
                        {addressText(item)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      ) : (
        /* ─── DETAIL VIEW ─── */
        <View style={{ flex: 1 }}>
          {detailLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Đang tải chi tiết tòa nhà...</Text>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
                {/* Building Info Card */}
                <View style={styles.detailInfoBox}>
                  <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={18} color={Colors.primary} />
                    <Text style={styles.detailText}>{selectedBuilding ? addressText(selectedBuilding) : ''}</Text>
                  </View>
                  <View style={[styles.detailRow, { marginTop: Spacing.sm }]}>
                    <Ionicons name="time-outline" size={18} color={Colors.primary} />
                    <Text style={styles.detailText}>Mở cửa: 24/7</Text>
                  </View>
                  <View style={[styles.detailRow, { marginTop: Spacing.sm }]}>
                    <Ionicons name="call-outline" size={18} color={Colors.primary} />
                    <Text style={styles.detailText}>Hotline hỗ trợ: 1900 636 447</Text>
                  </View>
                </View>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                  <View style={styles.statBox}>
                    <Ionicons name="layers" size={20} color={Colors.blue} />
                    <Text style={styles.statLabel}>Số Tầng</Text>
                    <Text style={styles.statValue}>{floors.length}</Text>
                  </View>
                  <View style={[styles.statBox, { borderColor: Colors.successBorder }]}>
                    <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                    <Text style={styles.statLabel}>Chỗ Trống</Text>
                    <Text style={[styles.statValue, { color: Colors.success }]}>{availableSlots}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Ionicons name="grid" size={20} color={Colors.primary} />
                    <Text style={styles.statLabel}>Tổng Ô Đỗ</Text>
                    <Text style={styles.statValue}>{totalSlots}</Text>
                  </View>
                </View>

                {/* Supported Vehicle Types */}
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Loại xe hỗ trợ</Text>
                  <View style={styles.vehicleTypeRow}>
                    {vehicleTypes.length > 0 ? (
                      vehicleTypes.map((vt) => {
                        const isBike = guessVehicleCategory(vt.name) === 'motorcycle';
                        return (
                          <View
                            key={vt._id}
                            style={[
                              styles.vehicleBadge,
                              {
                                borderColor: isBike ? `${Colors.purple}30` : `${Colors.blue}30`,
                                backgroundColor: isBike ? Colors.purpleBg : Colors.blueBg,
                              },
                            ]}
                          >
                            <Ionicons
                              name={isBike ? 'bicycle' : 'car'}
                              size={14}
                              color={isBike ? Colors.purple : Colors.blue}
                              style={{ marginRight: 6 }}
                            />
                            <Text style={[styles.vehicleBadgeText, { color: isBike ? Colors.purple : Colors.blue }]}>
                              {vt.name}
                            </Text>
                          </View>
                        );
                      })
                    ) : (
                      <Text style={styles.emptyDetailText}>Đang cập nhật</Text>
                    )}
                  </View>
                </View>

                {/* Vehicle Plate Selection */}
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Chọn xe của bạn</Text>
                  <TouchableOpacity
                    style={styles.plateDropdown}
                    onPress={() => setShowPlateModal(true)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.plateDropdownLeft}>
                      <View style={styles.plateIconBox}>
                        <Ionicons
                          name={
                            selectedPlate &&
                            compatiblePlates.find((p) => p.plateNumber === selectedPlate)?.vehicleType === 'motorcycle'
                              ? 'bicycle'
                              : 'car'
                          }
                          size={20}
                          color={Colors.primary}
                        />
                      </View>
                      <View>
                        <Text style={styles.plateNumberText}>
                          {selectedPlate || 'Chọn biển số xe của bạn'}
                        </Text>
                        {selectedPlate ? (
                          <Text style={styles.plateTypeText}>
                            {compatiblePlates.find((p) => p.plateNumber === selectedPlate)?.vehicleType === 'motorcycle'
                              ? 'Xe máy'
                              : 'Ô tô'}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <Ionicons name="chevron-down" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                </View>

                {/* Floors Capacity & Layout */}
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Trạng thái các tầng</Text>
                  {floors.map((floor) => {
                    const isExpanded = expandedFloorId === floor._id;
                    const occupied = floor.totalSlots - floor.availableSlots;
                    const occupancyRate = floor.totalSlots ? occupied / floor.totalSlots : 0;
                    const percentText = `${Math.round(occupancyRate * 100)}%`;

                    let barColor = Colors.success;
                    if (occupancyRate > 0.9) {
                      barColor = Colors.error;
                    } else if (occupancyRate > 0.7) {
                      barColor = Colors.warning;
                    }

                    return (
                      <View key={floor._id} style={styles.floorCard}>
                        {/* Floor header toggling slots grid */}
                        <TouchableOpacity
                          style={styles.floorHeader}
                          onPress={() => toggleFloorSlots(floor._id)}
                          activeOpacity={0.8}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.floorName}>{floor.name || floor.code}</Text>
                            <Text style={styles.floorSlotsInfo}>
                              Trống: {floor.availableSlots} / {floor.totalSlots} ô
                            </Text>
                          </View>
                          <View style={styles.floorPercentBox}>
                            <Text style={[styles.floorPercentText, { color: barColor }]}>
                              Đầy {percentText}
                            </Text>
                            <Ionicons
                              name={isExpanded ? 'chevron-up' : 'chevron-down'}
                              size={18}
                              color={Colors.textMuted}
                              style={{ marginLeft: 8 }}
                            />
                          </View>
                        </TouchableOpacity>

                        {/* Progress Bar */}
                        <View style={styles.progressTrack}>
                          <View
                            style={[
                              styles.progressBar,
                              { width: `${occupancyRate * 100}%`, backgroundColor: barColor },
                            ]}
                          />
                        </View>

                        {/* Collapsible Slots Grid */}
                        {isExpanded ? (
                          <View style={styles.slotsGridContainer}>
                            {slotsLoading[floor._id] ? (
                              <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: Spacing.md }} />
                            ) : !floorSlots[floor._id] || floorSlots[floor._id].length === 0 ? (
                              <Text style={styles.emptyDetailText}>Không có ô đỗ nào</Text>
                            ) : (
                              <View style={styles.slotsGrid}>
                                {floorSlots[floor._id].map((slot) => {
                                  let bg = Colors.successBg;
                                  let border = Colors.successBorder;
                                  let textCol = Colors.success;

                                  if (slot.status === 'occupied') {
                                    bg = Colors.cardAlt;
                                    border = Colors.borderAlt;
                                    textCol = Colors.textMuted;
                                  } else if (slot.status === 'reserved') {
                                    bg = Colors.blueBg;
                                    border = 'rgba(59,130,246,0.25)';
                                    textCol = Colors.blue;
                                  } else if (slot.status === 'maintenance') {
                                    bg = Colors.errorBg;
                                    border = Colors.errorBorder;
                                    textCol = Colors.error;
                                  }

                                  const slotIcon = slot.code.toUpperCase().startsWith('M') ? '🏍️' : '🚗';

                                  return (
                                    <View
                                      key={slot._id}
                                      style={[
                                        styles.slotCell,
                                        { backgroundColor: bg, borderColor: border },
                                      ]}
                                    >
                                      <Text style={[styles.slotIconText, { color: textCol }]}>
                                        {slotIcon}
                                      </Text>
                                      <Text style={[styles.slotCodeText, { color: textCol }]}>
                                        {slot.code}
                                      </Text>
                                      <Text style={[styles.slotStatusText, { color: textCol }]}>
                                        {slot.status === 'available'
                                          ? 'Trống'
                                          : slot.status === 'occupied'
                                          ? 'Đang đỗ'
                                          : slot.status === 'reserved'
                                          ? 'Đã đặt'
                                          : 'Bảo trì'}
                                      </Text>
                                    </View>
                                  );
                                })}
                              </View>
                            )}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Sticky Bottom Actions */}
              <View style={styles.bottomBar}>
                <TouchableOpacity
                  style={[styles.bookingButton, !canProceed && styles.disabledButton]}
                  onPress={handleBookingRedirect}
                  disabled={!canProceed}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar" size={20} color="#000" style={{ marginRight: 8 }} />
                  <Text style={styles.bookingButtonText}>Đặt Chỗ Ngay</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ─── LICENSE PLATE SELECTION MODAL ─── */}
      <Modal visible={showPlateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn xe của bạn</Text>
              <TouchableOpacity onPress={() => setShowPlateModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {compatiblePlates.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Text style={styles.modalEmptyText}>
                  Bạn chưa đăng ký biển số xe nào phù hợp với loại xe được hỗ trợ tại tòa nhà này.
                </Text>
              </View>
            ) : (
              <FlatList
                data={compatiblePlates}
                keyExtractor={(item) => item._id || item.plateNumber}
                renderItem={({ item }) => {
                  const isSelected = item.plateNumber === selectedPlate;
                  return (
                    <TouchableOpacity
                      style={[styles.plateItem, isSelected && styles.plateItemSelected]}
                      onPress={() => {
                        setSelectedPlate(item.plateNumber);
                        setShowPlateModal(false);
                      }}
                    >
                      <Ionicons
                        name={item.vehicleType === 'motorcycle' ? 'bicycle' : 'car'}
                        size={22}
                        color={isSelected ? Colors.primary : Colors.textMuted}
                        style={{ marginRight: Spacing.md }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.plateItemText, isSelected && styles.plateItemTextSelected]}>
                          {item.plateNumber}
                        </Text>
                        <Text style={styles.plateItemType}>
                          {item.vehicleType === 'motorcycle' ? 'Xe máy' : 'Ô tô'}
                        </Text>
                      </View>
                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                      ) : null}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['2xl'],
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginTop: Spacing.md,
    fontWeight: '600',
  },
  emptyText: {
    color: Colors.textDim,
    fontSize: FontSize.base,
    marginTop: Spacing.md,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.cardAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    height: 46,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['2xl'],
  },
  buildingCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  buildingCode: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  buildingName: {
    color: Colors.text,
    fontSize: FontSize.base,
    fontWeight: '700',
    marginTop: Spacing.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successBg,
    borderColor: Colors.successBorder,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
    marginRight: 6,
  },
  statusText: {
    color: Colors.success,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  cardAddress: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '500',
    flex: 1,
  },
  detailScroll: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
  },
  detailInfoBox: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginLeft: Spacing.sm,
    flex: 1,
    fontWeight: '600',
    lineHeight: 18,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statLabel: {
    color: Colors.textDim,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: Spacing.sm,
  },
  statValue: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '900',
    marginTop: 2,
  },
  sectionContainer: {
    marginTop: Spacing.xl,
  },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
  },
  vehicleTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.xs,
  },
  vehicleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  vehicleBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  emptyDetailText: {
    color: Colors.textDim,
    fontSize: FontSize.sm,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  plateDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  plateDropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  plateIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.cardAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  plateNumberText: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  plateTypeText: {
    color: Colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  floorCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  floorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  floorName: {
    color: Colors.text,
    fontSize: FontSize.base,
    fontWeight: '800',
  },
  floorSlotsInfo: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginTop: 4,
  },
  floorPercentBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  floorPercentText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.cardAlt,
    borderRadius: 3,
    marginTop: Spacing.md,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  slotsGridContainer: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginHorizontal: -4,
  },
  slotCell: {
    width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.lg * 2 - 16) / 3, // 3 columns
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    marginHorizontal: 4,
    marginBottom: Spacing.sm,
  },
  slotIconText: {
    fontSize: 14,
    marginBottom: 2,
  },
  slotCodeText: {
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  slotStatusText: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
    opacity: 0.8,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(2, 6, 23, 0.9)',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? Spacing.xl : Spacing.md,
  },
  bookingButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.4,
  },
  bookingButtonText: {
    color: '#000',
    fontSize: FontSize.base,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    maxHeight: '60%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.md,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  modalEmpty: {
    paddingVertical: Spacing['2xl'],
    alignItems: 'center',
  },
  modalEmptyText: {
    color: Colors.textDim,
    fontSize: FontSize.sm,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 18,
  },
  plateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  plateItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryGlow,
  },
  plateItemText: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  plateItemTextSelected: {
    color: Colors.primary,
  },
  plateItemType: {
    color: Colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 2,
  },
});
