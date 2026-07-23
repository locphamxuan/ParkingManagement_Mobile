import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { styles } from '../../styles/screens/packages';
import { AnimatedPressable, AnimatedCard } from '../ui/AnimatedCard';
import { fmtMoney, vtCode } from '../../utils/packageHelpers';
import type { LongTermPackage } from '../../types';

interface PackageCardProps {
  pkg: LongTermPackage;
  index: number;
  onSubscribe: (pkg: LongTermPackage) => void;
}

/** Single browse-tab package card (theme by duration tier + Subscribe Now button). */
export function PackageCard({ pkg, index, onSubscribe }: PackageCardProps) {
  const code = vtCode(pkg.vehicleType);
  const isCar = String(code || (typeof pkg.vehicleType === 'string' ? pkg.vehicleType : (pkg.vehicleType?.name || ''))).toLowerCase().includes('car');
  const isWeekly = pkg.durationDays <= 7;
  const isMonthly = pkg.durationDays <= 30 && pkg.durationDays > 7;
  const tagLabel = isWeekly ? 'Weekly' : isMonthly ? 'Monthly' : 'Yearly';

  const themeColor = isWeekly ? Colors.primary : isMonthly ? Colors.blue : Colors.purple;
  const themeBg = isWeekly ? 'rgba(14,165,233,0.12)' : isMonthly ? 'rgba(59,130,246,0.12)' : 'rgba(168,85,247,0.12)';
  const borderThemeColor = isWeekly ? 'rgba(14,165,233,0.18)' : isMonthly ? 'rgba(59,130,246,0.18)' : 'rgba(168,85,247,0.22)';

  return (
    <AnimatedCard
      index={index}
      style={[
        styles.pkgCard,
        {
          borderColor: borderThemeColor,
          borderLeftColor: themeColor,
          shadowColor: themeColor,
        },
      ]}
    >
      <View style={styles.pkgHeaderRow}>
        <Text style={[styles.pkgTagBadge, { backgroundColor: themeBg, color: themeColor }]}>{tagLabel}</Text>
        <View style={[
          styles.pkgVehicleBadge,
          {
            borderColor: isCar ? 'rgba(59,130,246,0.12)' : 'rgba(16,185,129,0.12)',
            backgroundColor: isCar ? 'rgba(59,130,246,0.03)' : 'rgba(16,185,129,0.03)',
          },
        ]}>
          <Ionicons name={isCar ? 'car' : 'bicycle'} size={10} color={isCar ? Colors.blue : Colors.success} />
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
          onPress={() => onSubscribe(pkg)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="card-outline" size={14} color="#ffffff" />
            <Text style={styles.pkgActionBtnText}>Subscribe Now</Text>
          </View>
        </AnimatedPressable>
      </View>
    </AnimatedCard>
  );
}
