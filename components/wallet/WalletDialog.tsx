import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { styles } from '../../styles/screens/wallet';

export interface WalletDialogState {
  visible: boolean;
  title: string;
  message: string;
  type: 'alert' | 'confirm' | 'error' | 'success';
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

interface WalletDialogProps {
  dialog: WalletDialogState;
  onRequestClose: () => void;
}

/** Dialog dùng chung của màn Wallet (alert/confirm/error/success). */
export function WalletDialog({ dialog, onRequestClose }: WalletDialogProps) {
  return (
    <Modal visible={dialog.visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <View style={styles.dialogOverlay}>
        <View style={styles.dialogContainer}>
          <View style={styles.dialogIconContainer}>
            {dialog.type === 'success' && <Ionicons name="checkmark-circle" size={42} color={Colors.success} />}
            {dialog.type === 'error' && <Ionicons name="alert-circle" size={42} color={Colors.error} />}
            {dialog.type === 'confirm' && <Ionicons name="warning" size={42} color={Colors.amber} />}
            {dialog.type === 'alert' && <Ionicons name="information-circle" size={42} color={Colors.primary} />}
          </View>

          <Text style={styles.dialogTitle}>{dialog.title}</Text>
          <Text style={styles.dialogMessage}>{dialog.message}</Text>

          <View style={styles.dialogActions}>
            <TouchableOpacity
              style={[
                styles.dialogBtn,
                dialog.type === 'confirm' ? styles.dialogBtnConfirmDanger : styles.dialogBtnConfirmPrimary
              ]}
              onPress={dialog.onConfirm}
            >
              <Text style={styles.dialogBtnConfirmText}>{dialog.confirmText || 'OK'}</Text>
            </TouchableOpacity>
            {dialog.type === 'confirm' && (
              <TouchableOpacity style={[styles.dialogBtn, styles.dialogBtnCancel]} onPress={dialog.onCancel}>
                <Text style={styles.dialogBtnCancelText}>{dialog.cancelText || 'Cancel'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
