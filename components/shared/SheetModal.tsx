import React from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { commonStyles } from '../../styles/common';

interface SheetModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Set false to render content without the inner ScrollView. */
  scroll?: boolean;
}

/**
 * Bottom-sheet modal scaffold (overlay + backdrop tap-to-close + grab handle).
 * Replaces the duplicated Modal/overlay/backdrop/handle markup across modals.
 */
export function SheetModal({ visible, onClose, children, scroll = true }: SheetModalProps) {
  const body = (
    <View style={commonStyles.sheet}>
      <View style={commonStyles.sheetHandleRow}>
        <View style={commonStyles.sheetHandle} />
      </View>
      {children}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={commonStyles.sheetOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={commonStyles.sheetBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        </View>
        <View style={commonStyles.sheetContainer}>
          {scroll ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={false}
              contentContainerStyle={commonStyles.sheetScroll}
            >
              {body}
            </ScrollView>
          ) : (
            body
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default SheetModal;
