import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { listBuildings, getBuildingVehicleTypes, type BuildingOption, type VehicleTypeOption } from '../services/buildingLookup';
import { guessVehicleCategory, vehicleCategoryFromPlate, vehicleCategoryFromVehicleType } from '../utils/vehicle';
import { getBuildingFloors, getFloorSlots, type FloorWithAvailability, type SlotItem } from '../services/floors';
import { Colors, FontSize, Radius, Spacing } from '../constants/theme';
import { styles } from '../styles/screens/buildings';
import { BuildingPlateModal } from '../components/buildings/BuildingPlateModal';
import type { LicensePlate } from '../types';
import { CustomDialog, useCustomDialog } from '../components/shared/CustomDialog';

/* ─── Helpers ──────────────────────────────────────────────────────────────── */



function addressText(building: BuildingOption): string {
  if (!building.address) return 'Address not updated';
  if (typeof building.address === 'string') return building.address;
  return building.address.fullAddress || 'Address not updated';
}


function plateMatchesVehicleTypes(plate: LicensePlate, vtypes: VehicleTypeOption[]): boolean {
  if (vtypes.length === 0) return true;
  const plateCategory = vehicleCategoryFromPlate(plate.vehicleType);
  return vtypes.some((vt) => vehicleCategoryFromVehicleType(vt) === plateCategory);
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
  // Dialog alert/confirm dùng chung (thay Alert.alert native).
  const { dialog, showCustomAlert, dismissDialog } = useCustomDialog();

  // Fetch building list — dùng lại cho pull-to-refresh.
  const fetchBuildings = useCallback(async () => {
    if (!token) return;
    try {
      const data = await listBuildings(token);
      setBuildings(data);
    } catch (err) {
      console.error('Failed to list buildings:', err);
    }
  }, [token]);

  useEffect(() => {
    setIsLoading(true);
    fetchBuildings().finally(() => setIsLoading(false));
  }, [fetchBuildings]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBuildings();
    setRefreshing(false);
  }, [fetchBuildings]);

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
      showCustomAlert('Error', 'Failed to load parking slot layout.', undefined, 'error');
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

  const handleViewLongTermPackages = () => {
    if (!canProceed || !selectedBuilding) return;
    router.push({
      pathname: '/(tabs)/packages',
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
          {selectedBuilding ? selectedBuilding.name : 'Parking'}
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
              placeholder="Search by name or address..."
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
              <Text style={styles.loadingText}>Loading buildings...</Text>
            </View>
          ) : filteredBuildings.length === 0 ? (
            <View style={styles.centered}>
              <Ionicons name="business" size={48} color={Colors.textDim} />
              <Text style={styles.emptyText}>No buildings found</Text>
            </View>
          ) : (
            <FlatList
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
                        <Text style={styles.statusText}>Active</Text>
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
              <Text style={styles.loadingText}>Loading building details...</Text>
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
                    <Text style={styles.detailText}>Open: 24/7</Text>
                  </View>
                  <View style={[styles.detailRow, { marginTop: Spacing.sm }]}>
                    <Ionicons name="call-outline" size={18} color={Colors.primary} />
                    <Text style={styles.detailText}>Hotline: 1900 636 447</Text>
                  </View>
                </View>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                  <View style={styles.statBox}>
                    <Ionicons name="layers" size={20} color={Colors.blue} />
                    <Text style={styles.statLabel}>Floors</Text>
                    <Text style={styles.statValue}>{floors.length}</Text>
                  </View>
                  <View style={[styles.statBox, { borderColor: Colors.successBorder }]}>
                    <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                    <Text style={styles.statLabel}>Available</Text>
                    <Text style={[styles.statValue, { color: Colors.success }]}>{availableSlots}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Ionicons name="grid" size={20} color={Colors.primary} />
                    <Text style={styles.statLabel}>Total Slots</Text>
                    <Text style={styles.statValue}>{totalSlots}</Text>
                  </View>
                </View>

                {/* Supported Vehicle Types */}
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Supported vehicle types</Text>
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
                      <Text style={styles.emptyDetailText}>Updating</Text>
                    )}
                  </View>
                </View>

                {/* Vehicle Plate Selection */}
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Select your vehicle</Text>
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
                            vehicleCategoryFromPlate(compatiblePlates.find((p) => p.plateNumber === selectedPlate)?.vehicleType) === 'motorcycle'
                              ? 'bicycle'
                              : 'car'
                          }
                          size={20}
                          color={Colors.primary}
                        />
                      </View>
                      <View>
                        <Text style={styles.plateNumberText}>
                          {selectedPlate || 'Select your license plate'}
                        </Text>
                        {selectedPlate ? (
                          <Text style={styles.plateTypeText}>
                            {vehicleCategoryFromPlate(compatiblePlates.find((p) => p.plateNumber === selectedPlate)?.vehicleType) === 'motorcycle'
                              ? 'Motorcycle'
                              : 'Car'}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <Ionicons name="chevron-down" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                </View>

                {/* Floors Capacity & Layout */}
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Floor status</Text>
                  {(() => {
                    const selectedPlateObj = compatiblePlates.find((p) => p.plateNumber === selectedPlate);
                    const selectedVtType = selectedPlateObj
                      ? vehicleCategoryFromPlate(selectedPlateObj.vehicleType)
                      : null;

                    const filteredFloors = floors.filter((floor) => {
                      if (!selectedVtType) return true;

                      const allowedVT = floor.allowedVehicleTypes || [];
                      return allowedVT.length === 0 || allowedVT.some(
                        (vt) => vehicleCategoryFromVehicleType(vt) === selectedVtType,
                      );
                    });

                    if (filteredFloors.length === 0) {
                      return (
                        <Text style={[styles.emptyDetailText, { textAlign: 'center', marginTop: 12 }]}>
                          No floors available for {selectedVtType === 'motorcycle' ? 'Motorcycles 🏍️' : 'Cars 🚗'} in this building.
                        </Text>
                      );
                    }

                    return filteredFloors.map((floor) => {
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
                                Available: {floor.availableSlots} / {floor.totalSlots} slots
                              </Text>
                            </View>
                            <View style={styles.floorPercentBox}>
                              <Text style={[styles.floorPercentText, { color: barColor }]}>
                                Full {percentText}
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
                                <Text style={styles.emptyDetailText}>No parking slots</Text>
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
                                            ? 'Available'
                                            : slot.status === 'occupied'
                                            ? 'Parked'
                                            : slot.status === 'reserved'
                                            ? 'Reserved'
                                            : 'Maintenance'}
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
                    });
                  })()}
                </View>
              </ScrollView>

              {/* Sticky Bottom Actions */}
              <View style={styles.bottomBar}>
                <Text style={styles.bookingHint}>
                  Walk-in parking is assigned when you check in at the gate.
                </Text>
                <TouchableOpacity
                  style={[styles.bookingButton, !canProceed && styles.disabledButton]}
                  onPress={handleViewLongTermPackages}
                  disabled={!canProceed}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="View long-term packages for the selected vehicle"
                >
                  <Ionicons name="cube-outline" size={20} color="#000" style={{ marginRight: 8 }} />
                  <Text style={styles.bookingButtonText}>View long-term packages</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      <BuildingPlateModal
        visible={showPlateModal}
        onClose={() => setShowPlateModal(false)}
        compatiblePlates={compatiblePlates}
        selectedPlate={selectedPlate}
        onSelect={(pn) => { setSelectedPlate(pn); setShowPlateModal(false); }}
      />
      <CustomDialog dialog={dialog} onDismiss={dismissDialog} />
    </SafeAreaView>
  );
}

