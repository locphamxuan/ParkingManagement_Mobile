import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { styles } from '../../styles/screens/packages';
import { PackageCard } from './PackageCard';
import type { LongTermPackage } from '../../types';

interface PackageGroup {
  building: LongTermPackage['building'];
  packages: LongTermPackage[];
}

interface BrowsePackagesListProps {
  groups: PackageGroup[];
  expandedBuildings: Record<string, boolean>;
  setExpandedBuildings: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  refreshing: boolean;
  onRefresh: () => void;
  onSubscribe: (pkg: LongTermPackage) => void;
}

/** Browse tab body: packages grouped by building with see-more/less per group. */
export function BrowsePackagesList({
  groups, expandedBuildings, setExpandedBuildings, refreshing, onRefresh, onSubscribe,
}: BrowsePackagesListProps) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
      }
      contentContainerStyle={styles.scrollContent}
    >
      {groups.map((group, gi) => {
        const buildingId = group.building?._id ?? gi.toString();
        const isExpanded = !!expandedBuildings[buildingId];
        const visiblePackages = isExpanded ? group.packages : group.packages.slice(0, 2);

        return (
          <View key={buildingId} style={styles.buildingGroup}>
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

            {visiblePackages.map((pkg, idx) => (
              <PackageCard key={pkg._id} pkg={pkg} index={idx} onSubscribe={onSubscribe} />
            ))}

            {group.packages.length > 2 && (
              <TouchableOpacity
                style={styles.seeMoreBtn}
                onPress={() => {
                  setExpandedBuildings((prev) => ({
                    ...prev,
                    [buildingId]: !prev[buildingId],
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
  );
}
