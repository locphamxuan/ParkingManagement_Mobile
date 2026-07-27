import { Modal, Pressable, View, Text, Image, TouchableOpacity } from 'react-native';
import { styles } from '../../styles/screens/profile';
import type { LicensePlate } from '../../types';

interface ProfilePlateModalsProps {
  plateToRemove: LicensePlate | null;
  loadingPlate: string | null;
  onCloseRemove: () => void;
  onConfirmRemove: () => void;
  plateQrToShow: LicensePlate | null;
  onCloseQr: () => void;
}

/** Hai modal của màn Profile: xác nhận xoá biển số + hiển thị QR của biển. */
export function ProfilePlateModals({
  plateToRemove, loadingPlate, onCloseRemove, onConfirmRemove, plateQrToShow, onCloseQr,
}: ProfilePlateModalsProps) {
  return (
    <>
      <Modal
        visible={plateToRemove !== null}
        transparent
        animationType="fade"
        onRequestClose={onCloseRemove}
      >
        <Pressable style={styles.confirmOverlay} onPress={onCloseRemove}>
          <View style={styles.confirmDialog}>
            <Text style={styles.confirmTitle}>Remove Plate</Text>
            <Text style={styles.confirmMessage}>
              {plateToRemove
                ? `Remove license plate "${plateToRemove.plateNumber}"?`
                : ''}
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnCancel]}
                onPress={onCloseRemove}
                disabled={Boolean(plateToRemove?._id && loadingPlate === plateToRemove._id)}
              >
                <Text style={styles.confirmBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnConfirm]}
                onPress={() => { void onConfirmRemove(); }}
                disabled={Boolean(plateToRemove?._id && loadingPlate === plateToRemove._id)}
              >
                <Text style={styles.confirmBtnConfirmText}>
                  {plateToRemove?._id && loadingPlate === plateToRemove._id ? 'Removing…' : 'Confirm'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Per-plate QR code modal — staff scans this to identify the vehicle */}
      <Modal
        visible={plateQrToShow !== null}
        transparent
        animationType="fade"
        onRequestClose={onCloseQr}
      >
        <Pressable style={styles.confirmOverlay} onPress={onCloseQr}>
          <View style={styles.qrDialog}>
            <Text style={styles.confirmTitle}>Plate QR Code</Text>
            <Text style={styles.qrPlateText}>{plateQrToShow?.plateNumber}</Text>
            {plateQrToShow?.qrCode ? (
              <View style={styles.plateQrImageWrap}>
                <Image
                  source={{
                    uri: `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(plateQrToShow.qrCode)}`,
                  }}
                  style={styles.plateQrImage}
                />
              </View>
            ) : null}
            <Text style={styles.qrHintText}>
              Show this code to staff at the gate to identify your vehicle.
            </Text>
            <TouchableOpacity
              style={[styles.confirmBtn, styles.confirmBtnCancel, { alignSelf: 'stretch' }]}
              onPress={onCloseQr}
            >
              <Text style={styles.confirmBtnCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
