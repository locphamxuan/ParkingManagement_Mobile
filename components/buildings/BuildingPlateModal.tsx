import { Modal, View, Text, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../constants/theme';
import { styles } from '../../styles/screens/buildings';
import type { LicensePlate } from '../../types';

interface BuildingPlateModalProps {
  visible: boolean;
  onClose: () => void;
  compatiblePlates: LicensePlate[];
  selectedPlate: string;
  onSelect: (plateNumber: string) => void;
}

/** Modal chọn biển số tương thích loại xe của toà (màn Buildings). */
export function BuildingPlateModal({ visible, onClose, compatiblePlates, selectedPlate, onSelect }: BuildingPlateModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select your vehicle</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {compatiblePlates.length === 0 ? (
            <View style={styles.modalEmpty}>
              <Text style={styles.modalEmptyText}>
                No license plates registered matching the vehicle types supported at this building.
              </Text>
            </View>
          ) : (
            <FlatList
              data={compatiblePlates}
              keyExtractor={(item) => item._id || item.plateNumber}
              renderItem={({ item }) => {
                const isSelected = item.plateNumber === selectedPlate;
                return (
                  <TouchableOpacity
                    style={[styles.plateItem, isSelected && styles.plateItemSelected]}
                    onPress={() => onSelect(item.plateNumber)}
                  >
                    <Ionicons
                      name={item.vehicleType === 'motorcycle' ? 'bicycle' : 'car'}
                      size={22}
                      color={isSelected ? Colors.primary : Colors.textMuted}
                      style={{ marginRight: Spacing.md }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.plateItemText, isSelected && styles.plateItemTextSelected]}>
                        {item.plateNumber}
                      </Text>
                      <Text style={styles.plateItemType}>
                        {item.vehicleType === 'motorcycle' ? 'Motorcycle' : 'Car'}
                      </Text>
                    </View>
                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
