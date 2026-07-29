import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Gradients } from '../../constants/theme';
import { styles } from '../../styles/screens/packages';
import { AnimatedPressable, AnimatedCard } from '../ui/AnimatedCard';
import { GradientView } from '../ui/GradientView';
import { fmtMoney } from '../../utils/packageHelpers';
import { vehicleCategoryFromVehicleType } from '../../utils/vehicle';
import type { LongTermPackage } from '../../types';

interface PackageCardProps {
  pkg: LongTermPackage;
  index: number;
  onSubscribe: (pkg: LongTermPackage) => void;
}

/** Single browse-tab package card (theme by duration tier + Subscribe Now button). */
export function PackageCard({ pkg, index, onSubscribe }: PackageCardProps) {
  const isCar = vehicleCategoryFromVehicleType(pkg.vehicleType) === 'car';
  const isWeekly = pkg.durationDays <= 7;
  const isMonthly = pkg.durationDays <= 30 && pkg.durationDays > 7;
  const tagLabel = isWeekly ? 'Weekly' : isMonthly ? 'Monthly' : 'Yearly';

  const themeColor = isWeekly ? Colors.primary : isMonthly ? Colors.blue : Colors.purple;
  const themeBg = isWeekly ? 'rgba(11,111,230,0.10)' : isMonthly ? 'rgba(37,99,237,0.10)' : 'rgba(124,58,237,0.10)';
  const vehicleColor = isCar ? Colors.blue : Colors.success;

  return (
    <AnimatedCard index={index} style={[styles.pkgCard, { borderLeftColor: themeColor }]}>
      <View style={styles.pkgHeaderRow}>
        <Text style={[styles.pkgTagBadge, { backgroundColor: themeBg, color: themeColor }]}>{tagLabel}</Text>
        <View style={[styles.pkgVehicleBadge, { borderColor: vehicleColor }]}>
          <Ionicons name={isCar ? 'car-outline' : 'bicycle-outline'} size={12} color={vehicleColor} />
          <Text style={[styles.pkgVehicleText, { color: vehicleColor }]}>
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
          <Ionicons name="time-outline" size={13} color={Colors.textDim} />
          <Text style={styles.tagText}>{pkg.durationDays} Days</Text>
        </View>
        <View style={styles.tag}>
          <Ionicons name="grid-outline" size={13} color={Colors.textDim} />
          <Text style={styles.tagText}>Optional Fixed Slot</Text>
        </View>
      </View>

      <View style={styles.pkgBottomRow}>
        <View>
          <Text style={styles.pkgPriceLabel}>Price</Text>
          <Text style={styles.pkgPriceText}>{fmtMoney(pkg.price)}</Text>
        </View>
        <AnimatedPressable
          onPress={() => onSubscribe(pkg)}
          accessibilityLabel={`Subscribe to ${pkg.name}`}
        >
          <GradientView colors={Gradients.primary} direction="horizontal" style={styles.pkgActionBtn}>
            <Ionicons name="card-outline" size={16} color="#ffffff" />
            <Text style={styles.pkgActionBtnText}>Subscribe Now</Text>
          </GradientView>
        </AnimatedPressable>
      </View>
    </AnimatedCard>
  );
}
