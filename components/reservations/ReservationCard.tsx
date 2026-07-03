import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Colors, Spacing } from '../../constants/theme';
import { styles } from '../../styles/screens/reservations';
import { fmtDate, fmtVND, statusLabel, statusVariant } from '../../utils/reservationFormat';
import { AnimatedCard } from './animations';

interface ReservationCardProps {
  r: any;
  index: number;
  cancellingId: string | null;
  renewingId: string | null;
  onCancel: (r: any) => void;
  onRenew: (r: any) => void;
}

// Thẻ hiển thị một booking (đặt chỗ theo giờ hoặc gói dài hạn) — tách từ reservations.tsx.
export function ReservationCard({ r, index, cancellingId, renewingId, onCancel, onRenew }: ReservationCardProps) {
  return (
    <AnimatedCard index={index} style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.plateTxt}>{r.plateNumber}</Text>
            {r.isSubscription && (
              <View style={{ backgroundColor: 'rgba(14,165,233,0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ color: Colors.primary, fontSize: 9, fontWeight: '800' }}>LONG-TERM</Text>
              </View>
            )}
          </View>
          {r.building && <Text style={styles.buildingTxt}>{r.building.name}</Text>}
          {r.slot && (
            <Text style={styles.slotTxt}>
              Slot {r.slot.code}
              {r.slot.floor !== undefined ? ` · Floor ${typeof r.slot.floor === 'object'
                ? ((r.slot.floor as any).name || (r.slot.floor as any).code || '')
                : r.slot.floor
                }` : ''}
            </Text>
          )}
        </View>
        <Badge label={statusLabel(r.status)} variant={statusVariant(r.status)} />
      </View>

      <View style={styles.divider} />

      <View style={styles.timeRow}>
        <View>
          <Text style={styles.timeLabel}>START</Text>
          <Text style={styles.timeValue}>{fmtDate(r.startTime)}</Text>
        </View>
        {r.endTime && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.timeLabel}>END</Text>
            <Text style={styles.timeValue}>{fmtDate(r.endTime)}</Text>
          </View>
        )}
      </View>

      {r.fee ? (
        <View style={styles.metaBox}>
          <View style={styles.metaItem}>
            <Ionicons name="wallet-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.metaText}>
              {r.isSubscription ? 'Package Price: ' : 'Deposit paid: '}
              <Text style={styles.metaStrong}>{fmtVND(r.fee)}</Text>
              {!r.isSubscription && ' (15%)'}
            </Text>
          </View>
        </View>
      ) : null}

      {r.isSubscription && r.rawSubscription?.package?.maxHoursPerDay ? (
        <View style={[styles.metaBox, { marginTop: 4 }]}>
          <View style={styles.metaItem}>
            <Ionicons name="hourglass-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.metaText}>
              Max Hours/Day: <Text style={styles.metaStrong}>{r.rawSubscription.package.maxHoursPerDay} hrs</Text>
            </Text>
          </View>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs }}>
        {(r.status === 'pending' || r.status === 'confirmed') && (
          <Button
            label={cancellingId === r._id ? 'Cancelling...' : (r.isSubscription ? 'Cancel Subscription' : 'Cancel Reservation')}
            onPress={() => onCancel(r)}
            variant="danger"
            size="sm"
            loading={cancellingId === r._id}
            style={{ alignSelf: 'flex-start' }}
          />
        )}
        {r.isSubscription && (r.status === 'confirmed' || r.status === 'expired') && !r.rawSubscription?.slotReleased && (
          <Button
            label={renewingId === r._id ? 'Renewing...' : 'Renew'}
            onPress={() => onRenew(r)}
            size="sm"
            loading={renewingId === r._id}
            style={{ alignSelf: 'flex-start' }}
          />
        )}
      </View>
    </AnimatedCard>
  );
}
