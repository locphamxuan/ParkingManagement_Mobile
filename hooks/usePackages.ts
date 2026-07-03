import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { listPackages, listSubscriptions } from '../services/longTerm';
import type { LongTermPackage, LicensePlate, LongTermSubscription } from '../types';
import { vtCode, groupByBuilding } from '../utils/packageHelpers';

/**
 * State + tải dữ liệu + lọc cho màn Gói dài hạn (Packages). Tách khỏi component
 * để phần JSX thuần trình bày.
 */
export function usePackages() {
  const { session } = useAuthStore();
  const token = session?.token ?? '';
  const plates: LicensePlate[] = session?.licensePlates ?? [];

  const [activeTab, setActiveTab] = useState<'browse' | 'my'>('browse');
  const params = useLocalSearchParams<{ tab?: string }>();

  useEffect(() => {
    if (params.tab === 'my') setActiveTab('my');
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
          listSubscriptions(token),
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
    const buildingName = pkg.building?.name || '';
    if (searchQuery.trim() !== '') {
      if (!buildingName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    }
    if (vehicleFilter !== 'all') {
      const codeStr = vtCode(pkg.vehicleType) || (typeof pkg.vehicleType === 'string' ? pkg.vehicleType : (pkg.vehicleType?.name || ''));
      const lower = codeStr.toLowerCase();
      if (vehicleFilter === 'car' && !lower.includes('car')) return false;
      if (vehicleFilter === 'motorcycle' && !(lower.includes('moto') || lower.includes('motorcycle') || lower.includes('xe máy'))) return false;
    }
    if (durationFilter !== 'all') {
      if (pkg.durationDays !== durationFilter) return false;
    }
    return true;
  });

  const groups = groupByBuilding(filteredPackages);

  // Filter subscriptions
  const filteredSubscriptions = subscriptions.filter((sub) => {
    const buildingName = sub.building?.name || sub.package?.building?.name || '';
    if (searchQuery.trim() !== '') {
      if (!buildingName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    }
    if (vehicleFilter !== 'all') {
      const vt = sub.package?.vehicleType;
      const codeStr = vtCode(vt) || (typeof vt === 'string' ? vt : (vt?.name || ''));
      const lower = codeStr.toLowerCase();
      if (vehicleFilter === 'car' && !lower.includes('car')) return false;
      if (vehicleFilter === 'motorcycle' && !(lower.includes('moto') || lower.includes('motorcycle') || lower.includes('xe máy'))) return false;
    }
    if (durationFilter !== 'all') {
      if (sub.package?.durationDays !== durationFilter) return false;
    }
    if (statusFilter !== 'all') {
      if (sub.status !== statusFilter) return false;
    }
    return true;
  });

  return {
    token, plates, session,
    activeTab, setActiveTab,
    packages, subscriptions, loading, refreshing, error,
    expandedBuildings, setExpandedBuildings,
    searchQuery, setSearchQuery,
    vehicleFilter, setVehicleFilter,
    durationFilter, setDurationFilter,
    statusFilter, setStatusFilter,
    expandedFilter, setExpandedFilter,
    load,
    filteredPackages, groups, filteredSubscriptions,
  };
}
