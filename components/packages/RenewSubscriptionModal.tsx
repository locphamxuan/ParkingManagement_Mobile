import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { sheet } from '../../styles/screens/packages';
import { fmtMoney, fmtDateOnly } from '../../utils/packageHelpers';
import type { LongTermSubscription } from '../../types';

interface RenewSubscriptionModalProps {
  sub: LongTermSubscription;
  renewing: boolean;
  renewErr: string | null;
  needsReplacement: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onChooseReplacement: () => void;
}

/** Bottom-sheet: confirm renewing an active/expired subscription (deducts wallet, extends endDate). */
export function RenewSubscriptionModal({
  sub,
  renewing,
  renewErr,
  needsReplacement,
  onClose,
  onConfirm,
  onChooseReplacement,
}: RenewSubscriptionModalProps) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 16, borderTopWidth: 1, borderColor: '#e2e8f0' }}>
          <View style={sheet.header}>
            <View>
              <Text style={sheet.headerEyebrowSuccess}>Renew Subscription</Text>
              <Text style={sheet.title}>{sub.package?.name ?? 'Long-term Package'}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle" size={26} color={Colors.textDim} />
            </TouchableOpacity>
          </View>

          <Text style={sheet.bodyText}>
            Renew subscription for plate {sub.plateNumber}? The package fee ({fmtMoney(sub.package?.price ?? 0)}) will be
            deducted from your wallet and the subscription period will be extended.
          </Text>

          <View style={sheet.infoCard}>
            <View style={sheet.infoRow}>
              <Text style={sheet.infoLabel}>License Plate</Text>
              <Text style={sheet.infoVal}>{sub.plateNumber}</Text>
            </View>
            <View style={sheet.infoRow}>
              <Text style={sheet.infoLabel}>Current End Date</Text>
              <Text style={sheet.infoVal}>{fmtDateOnly(sub.endDate)}</Text>
            </View>
            <View style={sheet.infoRowTotal}>
              <Text style={sheet.totalLabel}>Renewal Fee</Text>
              <Text style={sheet.totalVal}>{fmtMoney(sub.package?.price ?? 0)}</Text>
            </View>
          </View>

          {renewErr && (
            <View style={sheet.errorBoxSharp}>
              <Text style={sheet.errorBoxSharpText}>{renewErr}</Text>
            </View>
          )}

          <View style={sheet.actionsRow}>
            <TouchableOpacity onPress={onClose} disabled={renewing} style={sheet.secondaryBtn}>
              <Text style={sheet.secondaryBtnText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={needsReplacement ? onChooseReplacement : onConfirm}
              disabled={renewing}
              style={[sheet.renewBtn, renewing && sheet.renewBtnDisabled]}
            >
              <Text style={sheet.primaryBtnText}>
                {renewing
                  ? 'Processing...'
                  : needsReplacement
                    ? 'Browse Packages'
                    : 'Confirm Renew'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
