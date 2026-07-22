import React from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { usePackages } from '../../hooks/usePackages';
import { subscribe, cancelSubscription } from '../../services/longTerm';
import { SlotMapModal } from '../../components/reservations/SlotMapModal';
import { getBuildingFloors, getFloorSlots, type FloorWithAvailability, type SlotItem } from '../../services/floors';
import { AnimatedPressable, AnimatedCard } from '../../components/ui/AnimatedCard';
import { fmtMoney, fmtDateOnly, vtLabel, vtCode } from '../../utils/packageHelpers';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import { styles } from '../../styles/screens/packages';
import type { LongTermPackage, LicensePlate, LongTermSubscription } from '../../types';


export default function PackagesScreen() {
  const {
    token, plates, session, activeTab, setActiveTab,
    packages, subscriptions, loading, refreshing, error,
    expandedBuildings, setExpandedBuildings,
    searchQuery, setSearchQuery, vehicleFilter, setVehicleFilter,
    durationFilter, setDurationFilter, statusFilter, setStatusFilter,
    expandedFilter, setExpandedFilter, load,
    filteredPackages, groups, filteredSubscriptions,
  } = usePackages();

  const [selectedPkg, setSelectedPkg] = React.useState<LongTermPackage | null>(null);
  const [selectedPlate, setSelectedPlate] = React.useState<string>('');
  const [selectedSlot, setSelectedSlot] = React.useState<SlotItem | null>(null);
  const [showMapModal, setShowMapModal] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'2D' | '3D'>('2D');
  const [floors, setFloors] = React.useState<FloorWithAvailability[]>([]);
  const [selectedFloorId, setSelectedFloorId] = React.useState<string>('');
  const [slots, setSlots] = React.useState<SlotItem[]>([]);
  const [fetchingSlots, setFetchingSlots] = React.useState(false);
  const [purchasing, setPurchasing] = React.useState(false);
  const [purchaseErr, setPurchaseErr] = React.useState<string | null>(null);
  const [purchaseSuccessMsg, setPurchaseSuccessMsg] = React.useState<string | null>(null);

  // States for cancellation
  const [cancellingSub, setCancellingSub] = React.useState<LongTermSubscription | null>(null);
  const [cancelReason, setCancelReason] = React.useState<string>('no_longer_needed');
  const [cancelNote, setCancelNote] = React.useState<string>('');
  const [cancelling, setCancelling] = React.useState(false);
  const [cancelErr, setCancelErr] = React.useState<string | null>(null);

  const handleConfirmCancel = async () => {
    if (!cancellingSub) return;
    if (cancelReason === 'other' && !cancelNote.trim()) {
      setCancelErr('Please enter detailed reason for other option.');
      return;
    }
    setCancelling(true);
    setCancelErr(null);
    try {
      await cancelSubscription(token, cancellingSub._id, cancelReason, cancelNote);
      setCancellingSub(null);
      setCancelReason('no_longer_needed');
      setCancelNote('');
      load(true);
    } catch (err) {
      setCancelErr(err instanceof Error ? err.message : 'Failed to cancel package');
    } finally {
      setCancelling(false);
    }
  };

  const handleOpenSubscribe = async (pkg: LongTermPackage) => {
    setSelectedPkg(pkg);
    setSelectedSlot(null);
    setPurchaseErr(null);
    setPurchaseSuccessMsg(null);
    const code = vtCode(pkg.vehicleType) || '';
    const isCar = code.toLowerCase().includes('car') || (typeof pkg.vehicleType === 'string' && pkg.vehicleType.toLowerCase().includes('car'));
    const matched = plates.filter(p => isCar ? (p.vehicleType === 'car' || p.vehicleType?.toLowerCase().includes('car')) : (p.vehicleType === 'motorcycle' || p.vehicleType?.toLowerCase().includes('moto')));
    setSelectedPlate(matched[0]?.plateNumber || '');

    const bldId = pkg.building?._id || '';
    if (bldId && token) {
      try {
        const flList = await getBuildingFloors(token, bldId);
        setFloors(flList);
        
        // Find floors that support this vehicleType
        const pkgVtId = String(typeof pkg.vehicleType === 'object' && pkg.vehicleType ? pkg.vehicleType._id : pkg.vehicleType);
        const compatibleFloors = flList.filter(f => f.allowedVehicleTypes.map(String).includes(pkgVtId));
        
        if (compatibleFloors.length > 0) {
          setSelectedFloorId(compatibleFloors[0]._id);
          const slList = await getFloorSlots(token, bldId, compatibleFloors[0]._id);
          setSlots(slList);
        } else if (flList.length > 0) {
          setSelectedFloorId(flList[0]._id);
          const slList = await getFloorSlots(token, bldId, flList[0]._id);
          setSlots(slList);
        }
      } catch {}
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
      setPurchaseSuccessMsg('Successfully subscribed & locked your dedicated slot!');
      setTimeout(() => {
        setSelectedPkg(null);
        setSelectedSlot(null);
        setPurchaseSuccessMsg(null);
        setActiveTab('my');
        load(true);
      }, 1200);
    } catch (err) {
      setPurchaseErr(err instanceof Error ? err.message : 'Subscription failed. Please check your wallet balance.');
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>Long-term Packages</Text>
            <Text style={styles.headerTitle}>All Buildings</Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={() => load(true)}>
            <Ionicons name="refresh" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Top Tab Section */}
        <View style={styles.tabSection}>
          <AnimatedPressable
            style={[styles.topTab, activeTab === 'browse' && styles.topTabActive]}
            onPress={() => setActiveTab('browse')}
          >
            <Text style={[styles.topTabText, activeTab === 'browse' && styles.topTabTextActive]}>
              Browse Packages
            </Text>
          </AnimatedPressable>
          <AnimatedPressable
            style={[styles.topTab, activeTab === 'my' && styles.topTabActive]}
            onPress={() => setActiveTab('my')}
          >
            <Text style={[styles.topTabText, activeTab === 'my' && styles.topTabTextActive]}>
              My Packages
            </Text>
          </AnimatedPressable>
        </View>

        {/* Search & Collapsible Filters */}
        <View style={styles.filterSection}>
          {/* Search Input */}
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={16} color={Colors.textDim} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by building name..."
              placeholderTextColor={Colors.textDim}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                <Ionicons name="close-circle" size={16} color={Colors.textDim} />
              </TouchableOpacity>
            )}
          </View>

          {/* Collapsible Accordion Filter Headers */}
          <View style={styles.collapsibleFiltersRow}>
            {/* Vehicle Dropdown */}
            <TouchableOpacity
              style={[
                styles.dropdownHeader,
                expandedFilter === 'vehicle' && styles.dropdownHeaderExpanded,
                vehicleFilter !== 'all' && styles.dropdownHeaderActive
              ]}
              onPress={() => setExpandedFilter(expandedFilter === 'vehicle' ? null : 'vehicle')}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.dropdownHeaderText,
                (expandedFilter === 'vehicle' || vehicleFilter !== 'all') && styles.dropdownHeaderTextActive
              ]}>
                Vehicle: {vehicleFilter === 'all' ? 'All' : (vehicleFilter === 'car' ? 'Car' : 'Moto')}
              </Text>
              <Ionicons
                name={expandedFilter === 'vehicle' ? 'chevron-up' : 'chevron-down'}
                size={12}
                color={expandedFilter === 'vehicle' || vehicleFilter !== 'all' ? Colors.primary : Colors.textDim}
              />
            </TouchableOpacity>

            {/* Duration Dropdown */}
            <TouchableOpacity
              style={[
                styles.dropdownHeader,
                expandedFilter === 'duration' && styles.dropdownHeaderExpanded,
                durationFilter !== 'all' && styles.dropdownHeaderActive
              ]}
              onPress={() => setExpandedFilter(expandedFilter === 'duration' ? null : 'duration')}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.dropdownHeaderText,
                (expandedFilter === 'duration' || durationFilter !== 'all') && styles.dropdownHeaderTextActive
              ]}>
                Duration: {durationFilter === 'all' ? 'All' : (durationFilter === 7 ? '1W' : durationFilter === 30 ? '1M' : '1Y')}
              </Text>
              <Ionicons
                name={expandedFilter === 'duration' ? 'chevron-up' : 'chevron-down'}
                size={12}
                color={expandedFilter === 'duration' || durationFilter !== 'all' ? Colors.primary : Colors.textDim}
              />
            </TouchableOpacity>

            {/* Status Dropdown (only for My Packages) */}
            {activeTab === 'my' && (
              <TouchableOpacity
                style={[
                  styles.dropdownHeader,
                  expandedFilter === 'status' && styles.dropdownHeaderExpanded,
                  statusFilter !== 'all' && styles.dropdownHeaderActive
                ]}
                onPress={() => setExpandedFilter(expandedFilter === 'status' ? null : 'status')}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.dropdownHeaderText,
                  (expandedFilter === 'status' || statusFilter !== 'all') && styles.dropdownHeaderTextActive
                ]}>
                  Status: {statusFilter === 'all' ? 'All' : statusFilter.toUpperCase()}
                </Text>
                <Ionicons
                  name={expandedFilter === 'status' ? 'chevron-up' : 'chevron-down'}
                  size={12}
                  color={expandedFilter === 'status' || statusFilter !== 'all' ? Colors.primary : Colors.textDim}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Collapsed panels */}
          {expandedFilter === 'vehicle' && (
            <View style={styles.expandedOptionsPanel}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                <TouchableOpacity
                  style={[styles.filterChip, vehicleFilter === 'all' && styles.filterChipActive]}
                  onPress={() => { setVehicleFilter('all'); setExpandedFilter(null); }}
                >
                  <Text style={[styles.filterChipText, vehicleFilter === 'all' && styles.filterChipTextActive]}>All Vehicles</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterChip, vehicleFilter === 'car' && styles.filterChipActive]}
                  onPress={() => { setVehicleFilter('car'); setExpandedFilter(null); }}
                >
                  <Text style={[styles.filterChipText, vehicleFilter === 'car' && styles.filterChipTextActive]}>Car</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterChip, vehicleFilter === 'motorcycle' && styles.filterChipActive]}
                  onPress={() => { setVehicleFilter('motorcycle'); setExpandedFilter(null); }}
                >
                  <Text style={[styles.filterChipText, vehicleFilter === 'motorcycle' && styles.filterChipTextActive]}>Motorcycle</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}

          {expandedFilter === 'duration' && (
            <View style={styles.expandedOptionsPanel}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                <TouchableOpacity
                  style={[styles.filterChip, durationFilter === 'all' && styles.filterChipActive]}
                  onPress={() => { setDurationFilter('all'); setExpandedFilter(null); }}
                >
                  <Text style={[styles.filterChipText, durationFilter === 'all' && styles.filterChipTextActive]}>All Durations</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterChip, durationFilter === 7 && styles.filterChipActive]}
                  onPress={() => { setDurationFilter(7); setExpandedFilter(null); }}
                >
                  <Text style={[styles.filterChipText, durationFilter === 7 && styles.filterChipTextActive]}>1 Week</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterChip, durationFilter === 30 && styles.filterChipActive]}
                  onPress={() => { setDurationFilter(30); setExpandedFilter(null); }}
                >
                  <Text style={[styles.filterChipText, durationFilter === 30 && styles.filterChipTextActive]}>1 Month</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterChip, durationFilter === 365 && styles.filterChipActive]}
                  onPress={() => { setDurationFilter(365); setExpandedFilter(null); }}
                >
                  <Text style={[styles.filterChipText, durationFilter === 365 && styles.filterChipTextActive]}>1 Year</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}

          {expandedFilter === 'status' && activeTab === 'my' && (
            <View style={styles.expandedOptionsPanel}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                <TouchableOpacity
                  style={[styles.filterChip, statusFilter === 'all' && styles.filterChipActive]}
                  onPress={() => { setStatusFilter('all'); setExpandedFilter(null); }}
                >
                  <Text style={[styles.filterChipText, statusFilter === 'all' && styles.filterChipTextActive]}>All Status</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterChip, statusFilter === 'active' && styles.filterChipActive]}
                  onPress={() => { setStatusFilter('active'); setExpandedFilter(null); }}
                >
                  <Text style={[styles.filterChipText, statusFilter === 'active' && styles.filterChipTextActive]}>Active</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterChip, statusFilter === 'pending' && styles.filterChipActive]}
                  onPress={() => { setStatusFilter('pending'); setExpandedFilter(null); }}
                >
                  <Text style={[styles.filterChipText, statusFilter === 'pending' && styles.filterChipTextActive]}>Pending</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterChip, statusFilter === 'expired' && styles.filterChipActive]}
                  onPress={() => { setStatusFilter('expired'); setExpandedFilter(null); }}
                >
                  <Text style={[styles.filterChipText, statusFilter === 'expired' && styles.filterChipTextActive]}>Expired</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterChip, statusFilter === 'cancelled' && styles.filterChipActive]}
                  onPress={() => { setStatusFilter('cancelled'); setExpandedFilter(null); }}
                >
                  <Text style={[styles.filterChipText, statusFilter === 'cancelled' && styles.filterChipTextActive]}>Cancelled</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}
        </View>

        {/* Body */}
        {loading && (activeTab === 'browse' ? packages.length === 0 : subscriptions.length === 0) ? (
          <View style={styles.center}>
            <Text style={styles.dimText}>Loading...</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={32} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => load()} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (activeTab === 'browse' ? packages.length === 0 : subscriptions.length === 0) ? (
          <View style={styles.center}>
            <Ionicons name="cube-outline" size={40} color={Colors.textDim} />
            <Text style={styles.dimText}>
              {activeTab === 'browse' ? 'No packages available.' : 'You have not subscribed to any packages yet.'}
            </Text>
          </View>
        ) : (activeTab === 'browse' ? filteredPackages.length === 0 : filteredSubscriptions.length === 0) ? (
          <View style={styles.center}>
            <Ionicons name="search-outline" size={40} color={Colors.textDim} />
            <Text style={styles.dimText}>No items match your search/filters.</Text>
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setVehicleFilter('all');
                setDurationFilter('all');
                setStatusFilter('all');
                setExpandedFilter(null);
              }}
              style={styles.retryBtn}
            >
              <Text style={styles.retryText}>Clear Filters</Text>
            </TouchableOpacity>
          </View>
        ) : activeTab === 'browse' ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => load(true)}
                tintColor={Colors.primary}
              />
            }
            contentContainerStyle={styles.scrollContent}
          >
            {groups.map((group, gi) => {
              const buildingId = group.building?._id ?? gi.toString();
              const isExpanded = !!expandedBuildings[buildingId];
              const visiblePackages = isExpanded ? group.packages : group.packages.slice(0, 2);

              return (
                <View key={buildingId} style={styles.buildingGroup}>
                  {/* Building header */}
                  <View style={styles.buildingHeader}>
                    <Ionicons name="business-outline" size={15} color={Colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.buildingName}>
                        {group.building?.name ?? 'Unknown Building'}
                      </Text>
                      {group.building?.code ? (
                        <Text style={styles.buildingCode}>{group.building.code}</Text>
                      ) : null}
                      {group.building?.address?.fullAddress ? (
                        <Text style={styles.buildingAddr} numberOfLines={1}>
                          {group.building.address.fullAddress}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.countBadge}>
                      <Text style={styles.countText}>{group.packages.length} pkg{group.packages.length !== 1 ? 's' : ''}</Text>
                    </View>
                  </View>

                  {/* Package cards */}
                  {visiblePackages.map((pkg, idx) => {
                    const code = vtCode(pkg.vehicleType);
                    const isCar = String(code || (typeof pkg.vehicleType === 'string' ? pkg.vehicleType : (pkg.vehicleType?.name || ''))).toLowerCase().includes('car');
                    const isWeekly = pkg.durationDays <= 7;
                    const isMonthly = pkg.durationDays <= 30 && pkg.durationDays > 7;
                    const tagLabel = isWeekly ? 'Weekly' : isMonthly ? 'Monthly' : 'Yearly';

                    const themeColor = isWeekly ? Colors.primary : isMonthly ? Colors.blue : Colors.purple;
                    const themeBg = isWeekly ? 'rgba(14,165,233,0.12)' : isMonthly ? 'rgba(59,130,246,0.12)' : 'rgba(168,85,247,0.12)';
                    const borderThemeColor = isWeekly ? 'rgba(14,165,233,0.18)' : isMonthly ? 'rgba(59,130,246,0.18)' : 'rgba(168,85,247,0.22)';
                    const glowOrbColor = isWeekly ? 'rgba(14,165,233,0.06)' : isMonthly ? 'rgba(59,130,246,0.06)' : 'rgba(168,85,247,0.06)';

                    return (
                      <AnimatedCard
                        key={pkg._id}
                        index={idx}
                        style={[
                          styles.pkgCard,
                          {
                            borderColor: borderThemeColor,
                            borderLeftColor: themeColor,
                            shadowColor: themeColor,
                          }
                        ]}
                      >
                        <View style={styles.pkgHeaderRow}>
                          <Text style={[styles.pkgTagBadge, { backgroundColor: themeBg, color: themeColor }]}>{tagLabel}</Text>
                          <View style={[
                            styles.pkgVehicleBadge,
                            {
                              borderColor: isCar ? 'rgba(59,130,246,0.12)' : 'rgba(16,185,129,0.12)',
                              backgroundColor: isCar ? 'rgba(59,130,246,0.03)' : 'rgba(16,185,129,0.03)'
                            }
                          ]}>
                            <Ionicons name={isCar ? "car" : "bicycle"} size={10} color={isCar ? Colors.blue : Colors.success} />
                            <Text style={[styles.pkgVehicleText, { color: isCar ? Colors.blue : Colors.success }]}>
                              {isCar ? 'Car' : 'Motorcycle'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.pkgName}>{pkg.name}</Text>
                        {pkg.description ? (
                          <Text style={styles.pkgDesc} numberOfLines={2}>
                            {pkg.description}
                          </Text>
                        ) : null}
                        <View style={styles.pkgMetaRow}>
                          <View style={styles.tag}>
                            <Ionicons name="time-outline" size={12} color={Colors.textDim} />
                            <Text style={styles.tagText}>{pkg.durationDays} Days</Text>
                          </View>
                          <View style={styles.tag}>
                            <Ionicons name="grid-outline" size={12} color={Colors.textDim} />
                            <Text style={styles.tagText}>
                              {pkg.allowDedicatedSlot ? 'Dedicated Slot' : 'Flexible Slot'}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.pkgBottomRow}>
                          <View>
                            <Text style={styles.pkgPriceLabel}>PRICE</Text>
                            <Text style={styles.pkgPriceText}>{fmtMoney(pkg.price)}</Text>
                          </View>
                          <AnimatedPressable
                            style={[styles.pkgActionBtn, { backgroundColor: themeColor }]}
                            fullWidth={false}
                            onPress={() => handleOpenSubscribe(pkg)}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Ionicons name="card-outline" size={14} color="#ffffff" />
                              <Text style={styles.pkgActionBtnText}>Subscribe Now</Text>
                            </View>
                          </AnimatedPressable>
                        </View>
                      </AnimatedCard>
                    );
                  })}

                  {/* See more / See less button */}
                  {group.packages.length > 2 && (
                    <TouchableOpacity
                      style={styles.seeMoreBtn}
                      onPress={() => {
                        setExpandedBuildings(prev => ({
                          ...prev,
                          [buildingId]: !prev[buildingId]
                        }));
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.seeMoreText}>
                        {isExpanded ? 'See Less' : `See More (${group.packages.length - 2} more)`}
                      </Text>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={Colors.primary}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => load(true)}
                tintColor={Colors.primary}
              />
            }
            contentContainerStyle={styles.scrollContent}
          >
            {filteredSubscriptions.map((sub, idx) => {
              const pkg = sub.package;
              const bld = sub.building || pkg?.building;
              const hasDedicatedSlot = !!sub.slot;
              const statusColors = {
                active: { bg: 'rgba(22,163,74,0.12)', text: '#16a34a', label: 'Active' },
                pending: { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b', label: 'Pending' },
                expired: { bg: 'rgba(100,116,139,0.12)', text: Colors.textDim, label: 'Expired' },
                cancelled: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', label: 'Cancelled' },
              };
              const config = statusColors[sub.status] || { bg: 'rgba(100,116,139,0.12)', text: Colors.textDim, label: sub.status };

              return (
                <AnimatedCard
                  key={sub._id}
                  index={idx}
                  style={[
                    styles.subCard,
                    {
                      borderColor: config.bg,
                      borderLeftColor: config.text,
                    }
                  ]}
                >
                  <View style={styles.subCardTop}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.subPkgName}>{pkg?.name ?? 'Subscription Package'}</Text>
                      <Text style={styles.subBldName}>
                        <Ionicons name="business-outline" size={12} color={Colors.primary} />{' '}
                        {bld?.name ?? 'Unknown Building'} {bld?.code ? `(${bld.code})` : ''}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: config.text }]}>
                        {config.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.subCardDivider} />

                  <View style={styles.subDetailsGrid}>
                    <View style={styles.subDetailItem}>
                      <Text style={styles.subDetailLabel}>LICENSE PLATE</Text>
                      <Text style={styles.subDetailVal}>{sub.plateNumber}</Text>
                    </View>
                    <View style={styles.subDetailItem}>
                      <Text style={styles.subDetailLabel}>DURATION</Text>
                      <Text style={styles.subDetailVal}>{pkg?.durationDays ?? '—'} Days</Text>
                    </View>
                    <View style={styles.subDetailItem}>
                      <Text style={styles.subDetailLabel}>START DATE</Text>
                      <Text style={styles.subDetailVal}>{fmtDateOnly(sub.startDate)}</Text>
                    </View>
                    <View style={styles.subDetailItem}>
                      <Text style={styles.subDetailLabel}>END DATE</Text>
                      <Text style={styles.subDetailVal}>{fmtDateOnly(sub.endDate)}</Text>
                    </View>

                    {hasDedicatedSlot && (
                      <View style={[styles.subDetailItem, { minWidth: '100%', marginTop: 4 }]}>
                        <Text style={styles.subDetailLabel}>DEDICATED SLOT</Text>
                        <Text style={[styles.subDetailVal, { color: Colors.primary, fontWeight: '800' }]}>
                          Slot {sub.slot?.code} · Floor {typeof sub.slot?.floor === 'object' ? (sub.slot.floor?.name || sub.slot.floor?.code) : sub.slot?.floor}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.subCardDivider} />

                  <View style={styles.subCardBottom}>
                    <Text style={styles.subPriceLabel}>Price Paid</Text>
                    <Text style={styles.subPriceVal}>{fmtMoney(pkg?.price ?? 0)}</Text>
                  </View>

                  {sub.status === 'active' && (
                    <>
                      <View style={styles.subCardDivider} />
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <TouchableOpacity
                          onPress={() => {
                            setCancellingSub(sub);
                            setCancelReason('no_longer_needed');
                            setCancelNote('');
                            setCancelErr(null);
                          }}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: '#fca5a5',
                            backgroundColor: '#fef2f2',
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash-outline" size={14} color="#dc2626" />
                          <Text style={{ fontSize: 12, fontWeight: '800', color: '#dc2626' }}>Cancel Package</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </AnimatedCard>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Subscribe Package Purchase Modal */}
      {selectedPkg && (() => {
        const code = vtCode(selectedPkg.vehicleType) || '';
        const isCar = code.toLowerCase().includes('car') || (typeof selectedPkg.vehicleType === 'string' && selectedPkg.vehicleType.toLowerCase().includes('car'));
        const matchedPlates = plates.filter(p => isCar ? (p.vehicleType === 'car' || p.vehicleType?.toLowerCase().includes('car')) : (p.vehicleType === 'motorcycle' || p.vehicleType?.toLowerCase().includes('moto')));

        return (
          <Modal visible transparent animationType="slide" onRequestClose={() => setSelectedPkg(null)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' }}>
              <View style={{ backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 16, borderTopWidth: 1, borderColor: '#e2e8f0' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 1.2 }}>Confirm Package Subscription</Text>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: '#0f172a', marginTop: 2 }}>{selectedPkg.name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedPkg(null)}>
                    <Ionicons name="close-circle" size={26} color={Colors.textDim} />
                  </TouchableOpacity>
                </View>

                {/* Package Details */}
                <View style={{ backgroundColor: '#f8fafc', borderRadius: 16, padding: 14, gap: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: '#64748b' }}>Building</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1e293b' }}>{selectedPkg.building?.name || 'Building'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: '#64748b' }}>Vehicle Type</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: isCar ? Colors.blue : Colors.success }}>{isCar ? 'Car 🚗' : 'Motorcycle 🏍️'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: '#64748b' }}>Duration</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1e293b' }}>{selectedPkg.durationDays} Days</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#cbd5e1', paddingTop: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#334155' }}>Total Price</Text>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: Colors.primary }}>{fmtMoney(selectedPkg.price)}</Text>
                  </View>
                </View>

                {/* Vehicle License Plate Selection */}
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#334155' }}>
                    Select {isCar ? 'Car 🚗' : 'Motorcycle 🏍️'} License Plate:
                  </Text>
                  {matchedPlates.length > 0 ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {matchedPlates.map((p) => {
                        const isSel = selectedPlate === p.plateNumber;
                        return (
                          <TouchableOpacity
                            key={p.plateNumber}
                            onPress={() => setSelectedPlate(p.plateNumber)}
                            style={{
                              paddingHorizontal: 14,
                              paddingVertical: 10,
                              borderRadius: 12,
                              borderWidth: 1.5,
                              borderColor: isSel ? Colors.primary : '#cbd5e1',
                              backgroundColor: isSel ? 'rgba(14,165,233,0.1)' : '#ffffff',
                            }}
                          >
                            <Text style={{ fontSize: 13, fontWeight: '800', color: isSel ? Colors.primary : '#334155' }}>
                              {isCar ? '🚗' : '🏍️'} {p.plateNumber}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : (
                    <View style={{ backgroundColor: '#fef2f2', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#fca5a5' }}>
                      <Text style={{ fontSize: 12, color: '#991b1b', fontWeight: '600' }}>
                        ⚠️ You don't have any registered {isCar ? 'Car' : 'Motorcycle'} license plates in your account. Please add a vehicle plate in Profile first.
                      </Text>
                    </View>
                  )}
                </View>

                {/* Floor Selection if there are compatible floors */}
                {floors.length > 0 && (() => {
                  const pkgVtId = String(typeof selectedPkg.vehicleType === 'object' && selectedPkg.vehicleType ? selectedPkg.vehicleType._id : selectedPkg.vehicleType);
                  const compFloors = floors.filter(f => f.allowedVehicleTypes.map(String).includes(pkgVtId));
                  if (compFloors.length === 0) return null;

                  return (
                    <View style={{ gap: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#334155' }}>
                        Select Floor:
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {compFloors.map((f) => {
                          const isSel = selectedFloorId === f._id;
                          return (
                            <TouchableOpacity
                              key={f._id}
                              onPress={async () => {
                                setSelectedFloorId(f._id);
                                setSelectedSlot(null);
                                setFetchingSlots(true);
                                try {
                                  const slList = await getFloorSlots(token, selectedPkg.building?._id || '', f._id);
                                  setSlots(slList);
                                } catch {}
                                setFetchingSlots(false);
                              }}
                              style={{
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                                borderRadius: 12,
                                borderWidth: 1.5,
                                borderColor: isSel ? Colors.primary : '#cbd5e1',
                                backgroundColor: isSel ? 'rgba(14,165,233,0.1)' : '#ffffff',
                              }}
                            >
                              <Text style={{ fontSize: 13, fontWeight: '800', color: isSel ? Colors.primary : '#334155' }}>
                                {f.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })()}

                {/* Dedicated Slot Selection (Choose specific spot on 2D/3D map) */}
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#334155' }}>
                    Dedicated Reserved Slot:
                  </Text>
                  {selectedSlot ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f0fdf4', borderRadius: 14, padding: 12, borderWidth: 1.5, borderColor: '#86efac' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="checkmark-circle" size={20} color="#166534" />
                        <View>
                          <Text style={{ fontSize: 13, fontWeight: '900', color: '#166534' }}>
                            Slot {selectedSlot.code}
                          </Text>
                          <Text style={{ fontSize: 10, color: '#15803d', fontWeight: '600' }}>
                            Reserved Exclusively for {selectedPlate || 'your vehicle'}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => setShowMapModal(true)}
                        style={{ backgroundColor: '#166534', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#ffffff' }}>Change Spot</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => setShowMapModal(true)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        alignSelf: 'stretch',
                        gap: 8,
                        backgroundColor: '#f8fafc',
                        borderWidth: 1.5,
                        borderColor: Colors.primary,
                        borderStyle: 'dashed',
                        borderRadius: 14,
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                      }}
                    >
                      <Ionicons name="map-outline" size={18} color={Colors.primary} />
                      <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.primary }}>
                        📍 Click to Pick Specific Slot on 2D/3D Map
                      </Text>
                    </TouchableOpacity>
                  )}
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
                    selectedFloor={floors.find(f => f._id === selectedFloorId) || {
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
                    vehicleTypes={[]}
                    selectedVehicleTypeId=""
                    onSelectSlot={(slot) => {
                      setSelectedSlot(slot);
                      setShowMapModal(false);
                    }}
                  />
                )}

                {/* Status / Error messages */}
                {purchaseErr && (
                  <View style={{ backgroundColor: '#fef2f2', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#fca5a5' }}>
                    <Text style={{ fontSize: 12, color: '#991b1b', fontWeight: '700' }}>{purchaseErr}</Text>
                  </View>
                )}

                {purchaseSuccessMsg && (
                  <View style={{ backgroundColor: '#f0fdf4', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#86efac' }}>
                    <Text style={{ fontSize: 12, color: '#166534', fontWeight: '800' }}>✓ {purchaseSuccessMsg}</Text>
                  </View>
                )}

                {/* Action buttons */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                  <TouchableOpacity
                    onPress={() => setSelectedPkg(null)}
                    style={{ flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center' }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748b' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleConfirmSubscribe}
                    disabled={purchasing || !selectedPlate || matchedPlates.length === 0}
                    style={{
                      flex: 2,
                      paddingVertical: 12,
                      borderRadius: 14,
                      backgroundColor: Colors.primary,
                      alignItems: 'center',
                      opacity: purchasing || !selectedPlate || matchedPlates.length === 0 ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#ffffff' }}>
                      {purchasing ? 'Processing...' : 'Confirm Subscription'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        );
      })()}

      {/* Cancel Subscription Modal */}
      {cancellingSub && (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setCancellingSub(null)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 16, borderTopWidth: 1, borderColor: '#e2e8f0' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#ef4444', textTransform: 'uppercase', letterSpacing: 1.2 }}>Confirm Package Cancellation</Text>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: '#0f172a', marginTop: 2 }}>{cancellingSub.package?.name ?? 'Long-term Package'}</Text>
                </View>
                <TouchableOpacity onPress={() => setCancellingSub(null)}>
                  <Ionicons name="close-circle" size={26} color={Colors.textDim} />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 13, color: '#475569', lineHeight: 20 }}>
                Are you sure you want to cancel this long-term parking subscription? 
                This action will release your reserved parking slot and refund the balance back to your wallet according to the building's policies.
              </Text>

              {/* Package details preview */}
              <View style={{ backgroundColor: '#f8fafc', borderRadius: 16, padding: 14, gap: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, color: '#64748b' }}>License Plate</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#1e293b' }}>{cancellingSub.plateNumber}</Text>
                </View>
                {cancellingSub.slot && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: '#64748b' }}>Dedicated Slot</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.primary }}>Slot {cancellingSub.slot.code}</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, color: '#64748b' }}>Start Date</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#1e293b' }}>{fmtDateOnly(cancellingSub.startDate)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, color: '#64748b' }}>End Date</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#1e293b' }}>{fmtDateOnly(cancellingSub.endDate)}</Text>
                </View>
              </View>

              {/* Reason selector */}
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#334155' }}>Select cancellation reason:</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    { key: 'no_longer_needed', label: 'No longer needed' },
                    { key: 'change_slot', label: 'Change parking slot' },
                    { key: 'change_vehicle', label: 'Change vehicle' },
                    { key: 'pricing_issue', label: 'Pricing issues' },
                    { key: 'other', label: 'Other reason' },
                  ].map((item) => {
                    const isSel = cancelReason === item.key;
                    return (
                      <TouchableOpacity
                        key={item.key}
                        onPress={() => {
                          setCancelReason(item.key);
                          setCancelErr(null);
                        }}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 10,
                          borderWidth: 1.5,
                          borderColor: isSel ? '#ef4444' : '#cbd5e1',
                          backgroundColor: isSel ? 'rgba(239, 68, 68, 0.08)' : '#ffffff',
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: isSel ? '#ef4444' : '#334155' }}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Text Input for 'other' reason */}
              {cancelReason === 'other' && (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#334155' }}>Enter detailed reason:</Text>
                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: '#cbd5e1',
                      borderRadius: 12,
                      padding: 12,
                      fontSize: 13,
                      minHeight: 60,
                      textAlignVertical: 'top',
                      color: '#0f172a',
                    }}
                    multiline
                    numberOfLines={3}
                    placeholder="Please enter a specific reason..."
                    value={cancelNote}
                    onChangeText={setCancelNote}
                  />
                </View>
              )}

              {/* Error warning */}
              {cancelErr && (
                <View style={{ backgroundColor: '#fef2f2', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#fca5a5' }}>
                  <Text style={{ fontSize: 12, color: '#991b1b', fontWeight: '700' }}>⚠️ {cancelErr}</Text>
                </View>
              )}

              {/* Action buttons */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <TouchableOpacity
                  onPress={() => setCancellingSub(null)}
                  disabled={cancelling}
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748b' }}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleConfirmCancel}
                  disabled={cancelling}
                  style={{
                    flex: 2,
                    paddingVertical: 12,
                    borderRadius: 14,
                    backgroundColor: '#ef4444',
                    alignItems: 'center',
                    opacity: cancelling ? 0.6 : 1,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#ffffff' }}>
                    {cancelling ? 'Processing...' : 'Confirm Cancel'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

