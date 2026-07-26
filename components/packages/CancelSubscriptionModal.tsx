import { View, Text, TouchableOpacity, TextInput, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { sheet } from '../../styles/screens/packages';
import { fmtDateOnly } from '../../utils/packageHelpers';
import type { LongTermSubscription } from '../../types';
import type { RefundPreview } from '../../services/longTerm';

const CANCEL_REASONS = [
  { key: 'no_longer_needed', label: 'No longer needed' },
  { key: 'change_slot', label: 'Change parking slot' },
  { key: 'change_vehicle', label: 'Change vehicle' },
  { key: 'pricing_issue', label: 'Pricing issues' },
  { key: 'other', label: 'Other reason' },
];

interface CancelSubscriptionModalProps {
  sub: LongTermSubscription;
  cancelReason: string;
  setCancelReason: (v: string) => void;
  cancelNote: string;
  setCancelNote: (v: string) => void;
  cancelling: boolean;
  cancelErr: string | null;
  cancelSuccessMsg?: string | null;
  refundPreview?: RefundPreview | null;
  loadingPreview?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** Bottom-sheet: confirm cancelling an active subscription (reason + refund preview). */
export function CancelSubscriptionModal({
  sub, cancelReason, setCancelReason, cancelNote, setCancelNote,
  cancelling, cancelErr, cancelSuccessMsg, refundPreview, loadingPreview, onClose, onConfirm,
}: CancelSubscriptionModalProps) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 16, borderTopWidth: 1, borderColor: '#e2e8f0' }}>
          <View style={sheet.header}>
            <View>
              <Text style={sheet.headerEyebrowDanger}>Confirm Package Cancellation</Text>
              <Text style={sheet.title}>{sub.package?.name ?? 'Long-term Package'}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle" size={26} color={Colors.textDim} />
            </TouchableOpacity>
          </View>

          <Text style={sheet.bodyText}>
            Are you sure you want to cancel this long-term parking subscription?
            This action will release your reserved parking slot and refund the balance back to your wallet according to the building's policies.
          </Text>

          {loadingPreview ? (
            <View style={[sheet.infoRow, { justifyContent: 'center', gap: 8 }]}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={sheet.infoLabel}>Calculating your refund...</Text>
            </View>
          ) : refundPreview ? (
            <View style={sheet.infoCard}>
              <View style={sheet.infoRow}>
                <Text style={sheet.infoLabel}>Refund Amount</Text>
                <Text style={sheet.infoValPrimary}>
                  {refundPreview.refundPercent}% ({refundPreview.refundAmount.toLocaleString('en-US')} VND)
                </Text>
              </View>
            </View>
          ) : null}

          <View style={sheet.infoCard}>
            <View style={sheet.infoRow}>
              <Text style={sheet.infoLabel}>License Plate</Text>
              <Text style={sheet.infoVal}>{sub.plateNumber}</Text>
            </View>
            {sub.slot && (
              <View style={sheet.infoRow}>
                <Text style={sheet.infoLabel}>Fixed Slot</Text>
                <Text style={sheet.infoValPrimary}>Slot {sub.slot.code}</Text>
              </View>
            )}
            <View style={sheet.infoRow}>
              <Text style={sheet.infoLabel}>Start Date</Text>
              <Text style={sheet.infoVal}>{fmtDateOnly(sub.startDate)}</Text>
            </View>
            <View style={sheet.infoRow}>
              <Text style={sheet.infoLabel}>End Date</Text>
              <Text style={sheet.infoVal}>{fmtDateOnly(sub.endDate)}</Text>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={sheet.sectionLabel}>Select cancellation reason:</Text>
            <View style={sheet.chipsRow}>
              {CANCEL_REASONS.map((item) => {
                const isSel = cancelReason === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    onPress={() => setCancelReason(item.key)}
                    style={[sheet.reasonChip, isSel && sheet.reasonChipActive]}
                  >
                    <Text style={isSel ? sheet.reasonChipTextActive : sheet.reasonChipText}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {cancelReason === 'other' && (
            <View style={{ gap: 6 }}>
              <Text style={sheet.sectionLabel}>Enter detailed reason:</Text>
              <TextInput
                style={sheet.textarea}
                multiline
                numberOfLines={3}
                placeholder="Please enter a specific reason..."
                value={cancelNote}
                onChangeText={setCancelNote}
              />
            </View>
          )}

          {cancelSuccessMsg && (
            <View style={sheet.successBox}>
              <Text style={sheet.successBoxText}>✅ {cancelSuccessMsg}</Text>
            </View>
          )}

          {cancelErr && (
            <View style={sheet.errorBoxSharp}>
              <Text style={sheet.errorBoxSharpText}>⚠️ {cancelErr}</Text>
            </View>
          )}

          <View style={sheet.actionsRow}>
            <TouchableOpacity onPress={onClose} disabled={cancelling} style={sheet.secondaryBtn}>
              <Text style={sheet.secondaryBtnText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              disabled={cancelling || !!cancelSuccessMsg}
              style={[sheet.dangerBtn, (cancelling || !!cancelSuccessMsg) && sheet.dangerBtnDisabled]}
            >
              <Text style={sheet.primaryBtnText}>
                {cancelling ? 'Processing...' : 'Confirm Cancel'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
