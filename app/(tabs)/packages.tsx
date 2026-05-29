import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { listPackages, subscribe } from '../../services/longTerm';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import type { LongTermPackage, LicensePlate } from '../../types';

function fmtMoney(n: number) {
  return `${n.toLocaleString('en-US')} VND`;
}

function vtLabel(vt: LongTermPackage['vehicleType']): string {
  if (!vt) return 'All vehicles';
  if (typeof vt === 'string') {
    if (vt === 'car') return 'Car';
    if (vt === 'motorcycle') return 'Motorcycle';
    if (vt === 'all') return 'All vehicles';
    return vt;
  }
  return vt.name ?? 'All vehicles';
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

interface SubscribeSheetProps {
  pkg: LongTermPackage | null;
  plates: LicensePlate[];
  onClose: () => void;
  onDone: () => void;
  token: string;
}

function SubscribeSheet({ pkg, plates, onClose, onDone, token }: SubscribeSheetProps) {
  const [selectedPlate, setSelectedPlate] = useState<string>(
    plates.find((p) => p.isDefault)?.plateNumber ?? plates[0]?.plateNumber ?? '',
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pkg) return null;

  const buildingId = typeof pkg.building === 'object' && pkg.building ? pkg.building._id : '';

  const handleSubscribe = async () => {
    if (!selectedPlate) {
      setError('Please select a license plate.');
      return;
    }
    if (!buildingId) {
      setError('Building could not be determined.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await subscribe(token, pkg._id, selectedPlate, buildingId);
      const msg = `Successfully subscribed to "${pkg.name}"!`;
      if (Platform.OS === 'web') {
        (globalThis as any).alert?.(msg);
      } else {
        Alert.alert('Success', msg);
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Subscription failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={sheet.root}>
        {/* Header */}
        <View style={sheet.header}>
          <Text style={sheet.title}>Subscribe to Package</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={sheet.content}>
          {/* Package summary */}
          <View style={sheet.pkgCard}>
            <Text style={sheet.pkgName}>{pkg.name}</Text>
            {pkg.building && (
              <Text style={sheet.pkgBuilding}>
                {pkg.building.code} · {pkg.building.name}
              </Text>
            )}
            <View style={sheet.pkgMeta}>
              <View style={sheet.pkgMetaItem}>
                <Ionicons name="time-outline" size={13} color={Colors.textDim} />
                <Text style={sheet.pkgMetaText}>{pkg.durationDays} days</Text>
              </View>
              <View style={sheet.pkgMetaItem}>
                <Ionicons name="car-outline" size={13} color={Colors.textDim} />
                <Text style={sheet.pkgMetaText}>{vtLabel(pkg.vehicleType)}</Text>
              </View>
            </View>
            <Text style={sheet.pkgPrice}>{fmtMoney(pkg.price)}</Text>
            {pkg.description ? (
              <Text style={sheet.pkgDesc}>{pkg.description}</Text>
            ) : null}
          </View>

          {/* Plate selection */}
          <Text style={sheet.sectionLabel}>Select License Plate</Text>
          {plates.length === 0 ? (
            <View style={sheet.emptyPlate}>
              <Ionicons name="car-outline" size={32} color={Colors.textDim} />
              <Text style={sheet.emptyText}>
                No license plates saved. Add one in your Profile.
              </Text>
            </View>
          ) : (
            plates.map((plate) => (
              <TouchableOpacity
                key={plate.plateNumber}
                style={[
                  sheet.plateRow,
                  selectedPlate === plate.plateNumber && sheet.plateRowActive,
                ]}
                onPress={() => setSelectedPlate(plate.plateNumber)}
              >
                <View style={sheet.plateCheck}>
                  {selectedPlate === plate.plateNumber ? (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={20} color={Colors.textDim} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={sheet.plateNum}>{plate.plateNumber}</Text>
                  <Text style={sheet.plateSub}>
                    {plate.vehicleType === 'car' ? 'Car' : 'Motorcycle'}
                    {plate.isDefault ? ' · Default' : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}

          {error ? (
            <View style={sheet.errorBox}>
              <Ionicons name="alert-circle-outline" size={14} color={Colors.error} />
              <Text style={sheet.errorText}>{error}</Text>
            </View>
          ) : null}

          <Button
            label={`Confirm Subscription · ${fmtMoney(pkg.price)}`}
            onPress={() => { void handleSubscribe(); }}
            loading={loading}
            disabled={!selectedPlate || loading}
            style={sheet.submitBtn}
            fullWidth
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function PackagesScreen() {
  const { session } = useAuthStore();
  const token = session?.token ?? '';
  const plates: LicensePlate[] = session?.licensePlates ?? [];

  const [packages, setPackages] = useState<LongTermPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPkg, setSelectedPkg] = useState<LongTermPackage | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!token) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        // No buildingId → get all buildings
        const data = await listPackages(token);
        setPackages(data);
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

  const groups = groupByBuilding(packages);

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

        {/* Body */}
        {loading && packages.length === 0 ? (
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
        ) : packages.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="cube-outline" size={40} color={Colors.textDim} />
            <Text style={styles.dimText}>No packages available.</Text>
          </View>
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
            {groups.map((group, gi) => (
              <View key={group.building?._id ?? gi} style={styles.buildingGroup}>
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
                {group.packages.map((pkg) => {
                  const code = vtCode(pkg.vehicleType);
                  return (
                    <View key={pkg._id} style={styles.pkgCard}>
                      <View style={styles.pkgTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pkgName}>{pkg.name}</Text>
                          <View style={styles.pkgMetaRow}>
                            <View style={styles.tag}>
                              <Ionicons name="time-outline" size={11} color={Colors.textDim} />
                              <Text style={styles.tagText}>{pkg.durationDays} days</Text>
                            </View>
                            <View style={styles.tag}>
                              <Ionicons name="car-outline" size={11} color={Colors.textDim} />
                              <Text style={styles.tagText}>
                                {vtLabel(pkg.vehicleType)}
                                {code ? ` (${code})` : ''}
                              </Text>
                            </View>
                          </View>
                          {pkg.description ? (
                            <Text style={styles.pkgDesc} numberOfLines={2}>
                              {pkg.description}
                            </Text>
                          ) : null}
                        </View>
                        <View style={styles.pkgRight}>
                          <Text style={styles.pkgPrice}>{fmtMoney(pkg.price)}</Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.subscribeBtn}
                        onPress={() => setSelectedPkg(pkg)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="checkmark-circle-outline" size={14} color={Colors.card} />
                        <Text style={styles.subscribeBtnText}>Subscribe Now</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Subscribe modal */}
      {selectedPkg && (
        <SubscribeSheet
          pkg={selectedPkg}
          plates={plates}
          token={token}
          onClose={() => setSelectedPkg(null)}
          onDone={() => {
            setSelectedPkg(null);
            load(true);
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerLabel: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: Colors.primary,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: Spacing['2xl'],
  },
  dimText: { color: Colors.textDim, fontSize: FontSize.sm, textAlign: 'center' },
  errorText: { color: Colors.error, fontSize: FontSize.sm, textAlign: 'center' },
  retryBtn: {
    marginTop: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  retryText: { color: Colors.card, fontWeight: '700', fontSize: FontSize.sm },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing['3xl'] },

  buildingGroup: {
    marginBottom: Spacing['2xl'],
  },
  buildingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  buildingName: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.text,
  },
  buildingCode: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 1,
  },
  buildingAddr: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  countText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textMuted,
  },

  pkgCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  pkgTop: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  pkgName: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  pkgMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  pkgDesc: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    lineHeight: 16,
    marginTop: 4,
  },
  pkgRight: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  pkgPrice: {
    fontSize: FontSize.base,
    fontWeight: '800',
    color: Colors.primary,
  },

  subscribeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm + 2,
  },
  subscribeBtnText: {
    color: Colors.card,
    fontWeight: '700',
    fontSize: FontSize.sm,
  },
});

// ─── Subscribe sheet styles ───────────────────────────────────────────────────
const sheet = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  content: {
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  pkgCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  pkgName: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  pkgBuilding: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  pkgMeta: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  pkgMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pkgMetaText: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
  },
  pkgPrice: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: 4,
  },
  pkgDesc: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    lineHeight: 17,
  },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  emptyPlate: {
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textDim,
    textAlign: 'center',
    lineHeight: 18,
  },
  plateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xs,
  },
  plateRowActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(249,115,22,0.06)',
  },
  plateCheck: { width: 24, alignItems: 'center' },
  plateNum: {
    fontSize: FontSize.base,
    fontWeight: '800',
    color: Colors.text,
    fontFamily: 'monospace',
  },
  plateSub: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    marginTop: 2,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    padding: Spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.error,
  },
  submitBtn: {
    marginTop: Spacing.sm,
  },
});
