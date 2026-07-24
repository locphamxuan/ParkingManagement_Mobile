import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { styles } from '../../styles/screens/packages';
import { AnimatedCard } from '../ui/AnimatedCard';
import { fmtMoney, fmtDateOnly } from '../../utils/packageHelpers';
import type { LongTermSubscription } from '../../types';

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'rgba(22,163,74,0.12)', text: '#16a34a', label: 'Active' },
  pending: { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b', label: 'Pending' },
  expired: { bg: 'rgba(100,116,139,0.12)', text: Colors.textDim, label: 'Expired' },
  cancelled: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', label: 'Cancelled' },
};

interface SubscriptionCardProps {
  sub: LongTermSubscription;
  index: number;
  onCancel: (sub: LongTermSubscription) => void;
  onRenew: (sub: LongTermSubscription) => void;
}

/** Single "My Packages" card: details grid + Renew (active/expired) + Cancel (active) actions. */
export function SubscriptionCard({ sub, index, onCancel, onRenew }: SubscriptionCardProps) {
  const pkg = sub.package;
  const bld = sub.building || pkg?.building;
  const hasDedicatedSlot = !!sub.slot;
  const config = STATUS_COLORS[sub.status] || { bg: 'rgba(100,116,139,0.12)', text: Colors.textDim, label: sub.status };
  const canRenew = sub.status === 'active' || sub.status === 'expired';
  const canCancel = sub.status === 'active';

  return (
    <AnimatedCard
      index={index}
      style={[
        styles.subCard,
        {
          borderColor: config.bg,
          borderLeftColor: config.text,
        },
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

      {sub.status === 'expired' && (
        <Text style={styles.subExpiredHint}>
          Package expired — hourly rates apply. Renew to continue receiving parking benefits.
        </Text>
      )}

      {(canRenew || canCancel) && (
        <>
          <View style={styles.subCardDivider} />
          <View style={styles.subActionsRow}>
            {canRenew && (
              <TouchableOpacity onPress={() => onRenew(sub)} style={styles.subRenewBtn} activeOpacity={0.7}>
                <Ionicons name="refresh-outline" size={14} color="#16a34a" />
                <Text style={styles.subRenewBtnText}>Renew</Text>
              </TouchableOpacity>
            )}
            {canCancel && (
              <TouchableOpacity onPress={() => onCancel(sub)} style={styles.subCancelBtn} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={14} color="#dc2626" />
                <Text style={styles.subCancelBtnText}>Cancel Package</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </AnimatedCard>
  );
}
