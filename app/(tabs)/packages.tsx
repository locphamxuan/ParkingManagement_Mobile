import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Pressable,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { listPackages, listSubscriptions } from '../../services/longTerm';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import type { LongTermPackage, LongTermSubscription } from '../../types';

function AnimatedPressable({
  children,
  onPress,
  style,
  fullWidth = true,
}: {
  children: React.ReactNode;
  onPress: () => void;
  style?: any;
  fullWidth?: boolean;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.96, { duration: 100 });
  };
  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 150 });
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={style}>
      <Animated.View style={[
        { alignItems: 'center', justifyContent: 'center' },
        fullWidth && { width: '100%' },
        animatedStyle
      ]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

function AnimatedCard({ children, index, style }: { children: React.ReactNode; index: number; style?: any }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(15);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  React.useEffect(() => {
    opacity.value = withDelay(index * 60, withTiming(1, { duration: 400 }));
    translateY.value = withDelay(index * 60, withTiming(0, { duration: 400 }));
  }, [index]);

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

function fmtMoney(n: number) {
  return `${n.toLocaleString('en-US')} VND`;
}

function fmtDateOnly(s: string) {
  if (!s) return '—';
  const d = new Date(s);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}


function vtCode(vt: LongTermPackage['vehicleType']): string | null {
  if (!vt || typeof vt === 'string') return null;
  return vt.code ?? null;
}

// Group packages by building
function groupByBuilding(packages: LongTermPackage[]) {
  const map = new Map<string, { building: LongTermPackage['building']; packages: LongTermPackage[] }>();
  for (const pkg of packages) {
    const key = pkg.building?._id ?? '__unknown__';
    if (!map.has(key)) {
      map.set(key, { building: pkg.building ?? null, packages: [] });
    }
    map.get(key)!.packages.push(pkg);
  }
  return Array.from(map.values());
}

// SubscribeSheet removed to prevent direct purchase/subscription from packages page

export default function PackagesScreen() {
  const { session } = useAuthStore();
  const token = session?.token ?? '';

  const [activeTab, setActiveTab] = useState<'browse' | 'my'>('browse');
  const params = useLocalSearchParams<{ tab?: string }>();

  React.useEffect(() => {
    if (params.tab === 'my') {
      setActiveTab('my');
    }
  }, [params.tab]);
  const [packages, setPackages] = useState<LongTermPackage[]>([]);
  const [subscriptions, setSubscriptions] = useState<LongTermSubscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedBuildings, setExpandedBuildings] = useState<Record<string, boolean>>({});

  const [searchQuery, setSearchQuery] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState<'all' | 'car' | 'motorcycle'>('all');
  const [durationFilter, setDurationFilter] = useState<'all' | 7 | 30 | 365>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'expired' | 'cancelled'>('all');
  const [expandedFilter, setExpandedFilter] = useState<'vehicle' | 'duration' | 'status' | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!token) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [pkgData, subData] = await Promise.all([
          listPackages(token),
          listSubscriptions(token)
        ]);
        setPackages(pkgData);
        setSubscriptions(subData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load packages');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Filter packages
  const filteredPackages = packages.filter((pkg) => {
    // 1. Search by building name
    const buildingName = pkg.building?.name || '';
    if (searchQuery.trim() !== '') {
      if (!buildingName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
    }

    // 2. Vehicle filter
    if (vehicleFilter !== 'all') {
      const codeStr = vtCode(pkg.vehicleType) || (typeof pkg.vehicleType === 'string' ? pkg.vehicleType : (pkg.vehicleType?.name || ''));
      const lower = codeStr.toLowerCase();
      if (vehicleFilter === 'car' && !lower.includes('car')) return false;
      if (vehicleFilter === 'motorcycle' && !(lower.includes('moto') || lower.includes('motorcycle') || lower.includes('xe máy'))) return false;
    }

    // 3. Duration filter
    if (durationFilter !== 'all') {
      if (pkg.durationDays !== durationFilter) return false;
    }

    return true;
  });

  const groups = groupByBuilding(filteredPackages);

  // Filter subscriptions
  const filteredSubscriptions = subscriptions.filter((sub) => {
    // 1. Search by building name
    const buildingName = sub.building?.name || sub.package?.building?.name || '';
    if (searchQuery.trim() !== '') {
      if (!buildingName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
    }

    // 2. Vehicle filter
    if (vehicleFilter !== 'all') {
      const vt = sub.package?.vehicleType;
      const codeStr = vtCode(vt) || (typeof vt === 'string' ? vt : (vt?.name || ''));
      const lower = codeStr.toLowerCase();
      if (vehicleFilter === 'car' && !lower.includes('car')) return false;
      if (vehicleFilter === 'motorcycle' && !(lower.includes('moto') || lower.includes('motorcycle') || lower.includes('xe máy'))) return false;
    }

    // 3. Duration filter
    if (durationFilter !== 'all') {
      if (sub.package?.durationDays !== durationFilter) return false;
    }

    // 4. Status filter
    if (statusFilter !== 'all') {
      if (sub.status !== statusFilter) return false;
    }

    return true;
  });

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
                    const themeBg = isWeekly ? 'rgba(249,115,22,0.12)' : isMonthly ? 'rgba(59,130,246,0.12)' : 'rgba(168,85,247,0.12)';
                    const borderThemeColor = isWeekly ? 'rgba(249,115,22,0.18)' : isMonthly ? 'rgba(59,130,246,0.18)' : 'rgba(168,85,247,0.22)';
                    const glowOrbColor = isWeekly ? 'rgba(249,115,22,0.06)' : isMonthly ? 'rgba(59,130,246,0.06)' : 'rgba(168,85,247,0.06)';

                    return (
                      <AnimatedCard key={pkg._id} index={idx} style={[styles.pkgCard, { borderColor: borderThemeColor, shadowColor: themeColor }]}>
                        <View style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg - 1, overflow: 'hidden', pointerEvents: 'none' }]}>
                          <View style={[styles.pkgCardGlowOrb, { backgroundColor: glowOrbColor }]} />
                        </View>
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
                            onPress={() => {
                              const code = vtCode(pkg.vehicleType);
                              router.push({
                                pathname: '/(tabs)/reservations',
                                params: {
                                  buildingId: pkg.building?._id || '',
                                  packageId: pkg._id,
                                  vehicleType: code || 'car',
                                },
                              });
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Ionicons name="eye-outline" size={14} color="#ffffff" />
                              <Text style={styles.pkgActionBtnText}>View Now</Text>
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
                expired: { bg: 'rgba(100,116,139,0.12)', text: '#64748b', label: 'Expired' },
                cancelled: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', label: 'Cancelled' },
              };
              const config = statusColors[sub.status] || { bg: 'rgba(100,116,139,0.12)', text: '#64748b', label: sub.status };

              return (
                <AnimatedCard key={sub._id} index={idx} style={styles.subCard}>
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
                </AnimatedCard>
              );
            })}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.md, },
  headerLabel: { fontSize: FontSize.xs, fontWeight: '800', letterSpacing: 1.8, textTransform: 'uppercase', color: Colors.primary, },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, marginTop: 2, },
  refreshBtn: { width: 38, height: 38, borderRadius: Radius.md, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: Spacing['2xl'], },
  dimText: { color: Colors.textDim, fontSize: FontSize.sm, textAlign: 'center' },
  errorText: { color: Colors.error, fontSize: FontSize.sm, textAlign: 'center' },
  retryBtn: { marginTop: 4, backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, borderRadius: Radius.full, },
  retryText: { color: Colors.card, fontWeight: '700', fontSize: FontSize.sm },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing['3xl'] },
  buildingGroup: { marginBottom: Spacing['2xl'], },
  buildingHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.md, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border, },
  buildingName: { fontSize: FontSize.base, fontWeight: '700', color: Colors.text, },
  buildingCode: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary, marginTop: 1, },
  buildingAddr: { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 2, },
  countBadge: { backgroundColor: Colors.cardAlt, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderWidth: 1, borderColor: Colors.border, },
  countText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted, },
  pkgCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.06)', padding: Spacing.lg, marginBottom: Spacing.md, gap: Spacing.md, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3, },
  pkgCardGlowOrb: { position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: 70, },
  pkgHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', },
  pkgTagBadge: { fontSize: 9, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.sm, textTransform: 'uppercase', letterSpacing: 0.5, },
  pkgVehicleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, },
  pkgVehicleText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, },
  pkgName: { fontSize: FontSize.base, fontWeight: '700', color: Colors.text, marginTop: -2, },
  pkgDesc: { fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 18, marginTop: -4, },
  pkgMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: -2, },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', },
  tagText: { fontSize: 11, color: Colors.textDim, fontWeight: '600', },
  pkgBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: Spacing.md, marginTop: 2, },
  pkgPriceLabel: { fontSize: 8, fontWeight: '700', color: Colors.textDim, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2, },
  pkgPriceText: { fontSize: 15, fontWeight: '700', color: Colors.text, },
  pkgActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 8, },
  pkgActionBtnText: { color: '#ffffff', fontWeight: '800', fontSize: FontSize.xs, textTransform: 'uppercase', letterSpacing: 0.5, },
  seeMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: Spacing.sm, backgroundColor: Colors.cardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, marginTop: Spacing.xs, marginBottom: Spacing.sm, },
  seeMoreText: { color: Colors.primary, fontWeight: '700', fontSize: FontSize.xs, },
  filterSection: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.sm, gap: Spacing.sm, },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, height: 40, paddingHorizontal: Spacing.md, },
  searchIcon: { marginRight: Spacing.xs, },
  searchInput: { flex: 1, color: Colors.text, fontSize: FontSize.sm, paddingVertical: 0, },
  clearSearchBtn: { padding: 2, },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, },
  filterLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textDim, width: 60, },
  chipScroll: { gap: Spacing.xs, paddingRight: Spacing.xl, },
  filterChip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.full, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, },
  filterChipActive: { backgroundColor: 'rgba(249,115,22,0.15)', borderColor: Colors.primary, },
  filterChipText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', },
  filterChipTextActive: { color: Colors.primary, fontWeight: '700', },
  tabSection: { flexDirection: 'row', paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, paddingBottom: Spacing.md, gap: Spacing.md, },
  topTab: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderBottomWidth: 2, borderColor: 'transparent', },
  topTabActive: { borderColor: Colors.primary, },
  topTabText: { color: Colors.textMuted, fontWeight: '600', fontSize: FontSize.sm, },
  topTabTextActive: { color: Colors.primary, fontWeight: '800', },
  collapsibleFiltersRow: { flexDirection: 'row', gap: Spacing.sm, },
  dropdownHeader: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 10, height: 34, },
  dropdownHeaderExpanded: { borderColor: Colors.primary, },
  dropdownHeaderActive: { borderColor: 'rgba(249,115,22,0.4)', backgroundColor: 'rgba(249,115,22,0.06)', },
  dropdownHeaderText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', },
  dropdownHeaderTextActive: { color: Colors.primary, fontWeight: '700', },
  expandedOptionsPanel: { backgroundColor: Colors.cardAlt, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm, marginTop: -2, },
  subCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, marginBottom: Spacing.md, },
  subCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', },
  subPkgName: { fontSize: FontSize.base, fontWeight: '800', color: Colors.text, },
  subBldName: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, },
  statusBadgeText: { fontSize: 10, fontWeight: '800', },
  subCardDivider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md, },
  subDetailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, },
  subDetailItem: { minWidth: '45%', gap: 3, },
  subDetailLabel: { fontSize: 9, fontWeight: '800', color: Colors.textDim, letterSpacing: 0.5, },
  subDetailVal: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted, },
  subCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', },
  subPriceLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textDim, },
  subPriceVal: { fontSize: FontSize.base, fontWeight: '900', color: Colors.primary, },
});

