import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { styles } from '../../styles/screens/packages';
import { AnimatedPressable } from '../ui/AnimatedCard';

type ExpandedFilter = 'vehicle' | 'duration' | 'status' | null;

interface PackageFilterBarProps {
  activeTab: 'browse' | 'my';
  setActiveTab: (tab: 'browse' | 'my') => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  vehicleFilter: 'all' | 'car' | 'motorcycle';
  setVehicleFilter: (v: 'all' | 'car' | 'motorcycle') => void;
  durationFilter: 'all' | 7 | 30 | 365;
  setDurationFilter: (v: 'all' | 7 | 30 | 365) => void;
  statusFilter: 'all' | 'active' | 'pending' | 'expired' | 'cancelled';
  setStatusFilter: (v: 'all' | 'active' | 'pending' | 'expired' | 'cancelled') => void;
  expandedFilter: ExpandedFilter;
  setExpandedFilter: (v: ExpandedFilter) => void;
}

/** Top tabs (Browse/My Packages) + search + collapsible vehicle/duration/status filter chips. */
export function PackageFilterBar({
  activeTab, setActiveTab,
  searchQuery, setSearchQuery,
  vehicleFilter, setVehicleFilter,
  durationFilter, setDurationFilter,
  statusFilter, setStatusFilter,
  expandedFilter, setExpandedFilter,
}: PackageFilterBarProps) {
  return (
    <>
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

        <View style={styles.collapsibleFiltersRow}>
          <TouchableOpacity
            style={[
              styles.dropdownHeader,
              expandedFilter === 'vehicle' && styles.dropdownHeaderExpanded,
              vehicleFilter !== 'all' && styles.dropdownHeaderActive,
            ]}
            onPress={() => setExpandedFilter(expandedFilter === 'vehicle' ? null : 'vehicle')}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.dropdownHeaderText,
              (expandedFilter === 'vehicle' || vehicleFilter !== 'all') && styles.dropdownHeaderTextActive,
            ]}>
              Vehicle: {vehicleFilter === 'all' ? 'All' : (vehicleFilter === 'car' ? 'Car' : 'Moto')}
            </Text>
            <Ionicons
              name={expandedFilter === 'vehicle' ? 'chevron-up' : 'chevron-down'}
              size={12}
              color={expandedFilter === 'vehicle' || vehicleFilter !== 'all' ? Colors.primary : Colors.textDim}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.dropdownHeader,
              expandedFilter === 'duration' && styles.dropdownHeaderExpanded,
              durationFilter !== 'all' && styles.dropdownHeaderActive,
            ]}
            onPress={() => setExpandedFilter(expandedFilter === 'duration' ? null : 'duration')}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.dropdownHeaderText,
              (expandedFilter === 'duration' || durationFilter !== 'all') && styles.dropdownHeaderTextActive,
            ]}>
              Duration: {durationFilter === 'all' ? 'All' : (durationFilter === 7 ? '1W' : durationFilter === 30 ? '1M' : '1Y')}
            </Text>
            <Ionicons
              name={expandedFilter === 'duration' ? 'chevron-up' : 'chevron-down'}
              size={12}
              color={expandedFilter === 'duration' || durationFilter !== 'all' ? Colors.primary : Colors.textDim}
            />
          </TouchableOpacity>

          {activeTab === 'my' && (
            <TouchableOpacity
              style={[
                styles.dropdownHeader,
                expandedFilter === 'status' && styles.dropdownHeaderExpanded,
                statusFilter !== 'all' && styles.dropdownHeaderActive,
              ]}
              onPress={() => setExpandedFilter(expandedFilter === 'status' ? null : 'status')}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.dropdownHeaderText,
                (expandedFilter === 'status' || statusFilter !== 'all') && styles.dropdownHeaderTextActive,
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
    </>
  );
}
