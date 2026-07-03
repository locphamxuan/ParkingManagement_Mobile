import React, { useCallback, useState } from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { styles } from '../../styles/screens/reservations';

export type DialogType = 'alert' | 'confirm' | 'error' | 'success';

export interface DialogState {
  visible: boolean;
  title: string;
  message: string;
  type: DialogType;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

// Hook quản lý state dialog + 2 helper hiển thị alert/confirm — tách từ reservations.tsx.
export function useCustomDialog() {
  const [dialog, setDialog] = useState<DialogState>({
    visible: false,
    title: '',
    message: '',
    type: 'alert',
  });

  const showCustomAlert = useCallback((
    title: string,
    message: string,
    onConfirm?: () => void,
    type: 'alert' | 'error' | 'success' = 'alert',
  ) => {
    setDialog({
      visible: true,
      title,
      message,
      type,
      onConfirm: () => {
        setDialog((d) => ({ ...d, visible: false }));
        onConfirm?.();
      },
      confirmText: 'OK',
    });
  }, []);

  const showCustomConfirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    confirmText = 'Yes, Process',
    cancelText = 'Cancel',
  ) => {
    setDialog({
      visible: true,
      title,
      message,
      type: 'confirm',
      onConfirm: () => {
        setDialog((d) => ({ ...d, visible: false }));
        onConfirm();
      },
      onCancel: () => {
        setDialog((d) => ({ ...d, visible: false }));
        onCancel?.();
      },
      confirmText,
      cancelText,
    });
  }, []);

  const dismissDialog = useCallback(() => {
    setDialog((d) => ({ ...d, visible: false }));
  }, []);

  return { dialog, showCustomAlert, showCustomConfirm, dismissDialog };
}

// Modal alert/confirm tuỳ biến.
export function CustomDialog({ dialog, onDismiss }: { dialog: DialogState; onDismiss: () => void }) {
  return (
    <Modal visible={dialog.visible} transparent animationType="fade" onRequestClose={onDismiss}>
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
                dialog.type === 'confirm' ? styles.dialogBtnConfirmDanger : styles.dialogBtnConfirmPrimary,
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
