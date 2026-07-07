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
                </AnimatedCard>
              );
            })}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

