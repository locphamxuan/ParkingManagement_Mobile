import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../ui/Button';
import { Colors } from '../../constants/theme';
import { styles } from '../../styles/components/VehicleQrModal.styles';
import type { LicensePlate } from '../../types';

interface VehicleQrModalProps {
  visible: boolean;
  plates: LicensePlate[];
  loading: boolean;
  onClose: () => void;
  onManageVehicles: () => void;
}

function plateKey(plate: LicensePlate) {
  return plate._id ?? plate.plateNumber;
}

function vehicleLabel(vehicleType: LicensePlate['vehicleType']) {
  const labels: Record<LicensePlate['vehicleType'], string> = {
    motorcycle: 'Motorcycle',
    car: 'Car',
    ebike: 'E-bike',
    emotorbike: 'Electric motorcycle',
    suv: 'SUV',
    truck: 'Truck',
    other: 'Other vehicle',
  };
  return labels[vehicleType];
}

export function VehicleQrModal({
  visible,
  plates,
  loading,
  onClose,
  onManageVehicles,
}: VehicleQrModalProps) {
  const [selectedPlateKey, setSelectedPlateKey] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    if (!visible) {
      setShowQr(false);
      setSelectedPlateKey(null);
      return;
    }

    setSelectedPlateKey((current) => {
      if (current && plates.some((plate) => plateKey(plate) === current)) return current;
      const nextPlate = plates.find((plate) => plate.isDefault) ?? plates[0];
      return nextPlate ? plateKey(nextPlate) : null;
    });
  }, [visible, plates]);

  const selectedPlate = plates.find((plate) => plateKey(plate) === selectedPlateKey) ?? null;
  const canShowQr = Boolean(selectedPlate?.qrCode);

  const close = () => {
    setShowQr(false);
    onClose();
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerLeading}>
        {showQr ? (
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowQr(false)}
            accessibilityRole="button"
            accessibilityLabel="Choose another vehicle"
          >
            <Ionicons name="arrow-back" size={21} color={Colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerIcon}>
            <Ionicons name="qr-code-outline" size={21} color={Colors.primary} />
          </View>
        )}
        <Text style={styles.headerTitle}>{showQr ? 'Vehicle QR code' : 'Choose a vehicle'}</Text>
      </View>
      <TouchableOpacity
        style={styles.closeButton}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Close vehicle QR codes"
      >
        <Ionicons name="close" size={22} color={Colors.text} />
      </TouchableOpacity>
    </View>
  );

  const renderChooser = () => {
    if (loading && plates.length === 0) {
      return (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading your vehicle QR codes…</Text>
        </View>
      );
    }

    if (plates.length === 0) {
      return (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="car-outline" size={30} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No vehicle yet</Text>
          <Text style={styles.emptyText}>Add a license plate first. Each registered vehicle receives its own QR code.</Text>
          <Button label="Manage vehicles" onPress={onManageVehicles} variant="outline" fullWidth />
        </View>
      );
    }

    return (
      <>
        <Text style={styles.intro}>
          Select the vehicle you are parking, then show its unique QR code at the gate.
        </Text>
        <ScrollView style={{ maxHeight: 310 }} contentContainerStyle={styles.plateList} showsVerticalScrollIndicator={false}>
          {plates.map((plate) => {
            const isSelected = plateKey(plate) === selectedPlateKey;
            const isMotorcycle = plate.vehicleType === 'motorcycle';
            return (
              <Pressable
                key={plateKey(plate)}
                style={[styles.plateOption, isSelected && styles.plateOptionSelected]}
                onPress={() => setSelectedPlateKey(plateKey(plate))}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={plate.plateNumber + ', ' + vehicleLabel(plate.vehicleType)}
              >
                <View style={[styles.vehicleIcon, isSelected && styles.vehicleIconSelected]}>
                  <Ionicons name={isMotorcycle ? 'bicycle-outline' : 'car-outline'} size={21} color={isSelected ? Colors.primary : Colors.textMuted} />
                </View>
                <View style={styles.plateCopy}>
                  <Text style={styles.plateNumber}>{plate.plateNumber}</Text>
                  <Text style={styles.vehicleType}>{vehicleLabel(plate.vehicleType)}</Text>
                  {plate.isDefault ? (
                    <View style={styles.defaultBadge}><Text style={styles.defaultBadgeText}>Default vehicle</Text></View>
                  ) : null}
                </View>
                <View style={[styles.selectedIndicator, isSelected && styles.selectedIndicatorActive]}>
                  {isSelected ? <Ionicons name="checkmark" size={15} color={Colors.onPrimary} /> : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
        {!canShowQr ? (
          <View style={styles.unavailable}>
            <Ionicons name="information-circle-outline" size={19} color={Colors.warning} />
            <Text style={styles.unavailableText}>This vehicle QR is not available yet. Please refresh or manage your vehicles.</Text>
          </View>
        ) : null}
        <View style={styles.footer}>
          <Button
            label="Show vehicle QR"
            onPress={() => setShowQr(true)}
            disabled={!canShowQr}
            fullWidth
            accessibilityLabel={selectedPlate ? 'Show QR code for ' + selectedPlate.plateNumber : 'Show vehicle QR'}
          />
          {!canShowQr ? <Button label="Manage vehicles" onPress={onManageVehicles} variant="outline" fullWidth /> : null}
        </View>
      </>
    );
  };

  const renderQr = () => {
    if (!selectedPlate?.qrCode) return null;
    const qrUri = 'https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=' + encodeURIComponent(selectedPlate.qrCode);
    return (
      <View style={styles.qrContent}>
        <Text style={styles.qrDescription}>Show this code at the gate for your selected vehicle.</Text>
        <View style={styles.qrFrame}>
          <Image source={{ uri: qrUri }} style={styles.qrImage} accessibilityLabel={'QR code for ' + selectedPlate.plateNumber} />
        </View>
        <Text style={styles.qrPlate}>{selectedPlate.plateNumber}</Text>
        <Text style={styles.qrVehicleType}>{vehicleLabel(selectedPlate.vehicleType)}</Text>
        <View style={styles.footer}>
          <Button label="Change vehicle" onPress={() => setShowQr(false)} variant="outline" fullWidth />
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.handle} />
          {renderHeader()}
          {showQr ? renderQr() : renderChooser()}
        </View>
      </View>
    </Modal>
  );
}
