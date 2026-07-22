import React from 'react';
import {
  View,
  Text,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { styles } from '../../styles/screens/reservations';
import { Button } from '../ui/Button';
import { BookingDateModal } from '../ui/BookingDateModal';
import { type WizardStep } from '../../utils/reservationFormat';
import { WizardStep1 } from './WizardStep1';
import { WizardStep2 } from './WizardStep2';
import { WizardStep3 } from './WizardStep3';
import type { ReservationsVM } from '../../hooks/useReservations';

// Khung modal wizard 3 bước — step indicator + nav + tóm tắt; nội dung từng bước ở WizardStep{1,2,3}.
export function ReservationWizard({ vm }: { vm: ReservationsVM }) {
  const {
    showWizard, closeWizard, step, setStep,
    wizard,
    showBookingModal, setShowBookingModal,
    bookingType,
    reserveDedicatedSlot,
    summaryExpanded, setSummaryExpanded,
    activePkg,
    selectedFloor, selectedBuilding, vtCategory,
    displaySlotCode, slots,
    startDateTime, endDateTime, applyDateTime,
    creating,
    goToStep2, goToStep3, handleCreate,
  } = vm;

  return (
    <>
      {/* ── Wizard Modal ─────────────────────────────────────────────────────── */}
      <Modal visible={showWizard} transparent animationType="slide" onRequestClose={closeWizard}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {/* Step indicator */}
            <View style={styles.stepRow}>
              {[1, 2, 3].map((n, idx) => (
                <React.Fragment key={n}>
                  {idx > 0 && <View style={[styles.stepLine, step >= n && styles.stepLineActive]} />}
                  <View style={[styles.stepDot, step >= n && styles.stepDotActive]}>
                    <Text style={[styles.stepDotText, step >= n && styles.stepDotTextActive]}>{n}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>

            <Text style={styles.modalTitle}>
              {step === 1 ? 'Step 1 — Building & Vehicle'
                : step === 2 ? 'Step 2 — Floor & Slot'
                  : 'Step 3 — Time & Confirm'}
            </Text>

            {step === 1 && <WizardStep1 vm={vm} />}
            {step === 2 && <WizardStep2 vm={vm} />}
            {step === 3 && <WizardStep3 vm={vm} />}

            {/* Collapsible Summary Sheet */}
            {step > 1 && (
              <View style={[styles.bottomSummarySheet, summaryExpanded && styles.bottomSummarySheetExpanded]}>
                <TouchableOpacity
                  style={styles.summarySheetHeader}
                  activeOpacity={0.8}
                  onPress={() => setSummaryExpanded(!summaryExpanded)}
                >
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="receipt-outline" size={18} color={Colors.primary} />
                    <Text style={styles.summarySheetTitle}>Booking Summary</Text>
                  </View>
                  <Ionicons
                    name={summaryExpanded ? 'chevron-down-outline' : 'chevron-up-outline'}
                    size={18}
                    color={Colors.textMuted}
                  />
                </TouchableOpacity>

                {summaryExpanded && (
                  <View style={styles.summarySheetDetails}>
                    <View style={styles.summarySheetRow}>
                      <Text style={styles.summarySheetLabel}>Building</Text>
                      <Text style={styles.summarySheetValue}>{selectedBuilding?.name}</Text>
                    </View>
                    <View style={styles.summarySheetRow}>
                      <Text style={styles.summarySheetLabel}>Vehicle / Plate</Text>
                      <Text style={styles.summarySheetValue}>
                        {vtCategory === 'motorcycle' ? 'Motorbike' : vtCategory === 'car' ? 'Car' : ''}
                        {vtCategory ? '/' : ''}
                        {wizard.plateNumber}
                      </Text>
                    </View>
                    {reserveDedicatedSlot && wizard.slotId ? (
                      <View style={styles.summarySheetRow}>
                        <Text style={styles.summarySheetLabel}>Spot</Text>
                        <Text style={styles.summarySheetValue}>Floor {selectedFloor?.code} · Slot {displaySlotCode || slots.find(s => s._id === wizard.slotId)?.code}</Text>
                      </View>
                    ) : null}
                    {bookingType === 'package' && activePkg ? (
                      <>
                        <View style={styles.summarySheetRow}>
                          <Text style={styles.summarySheetLabel}>Package</Text>
                          <Text style={styles.summarySheetValue}>{activePkg.name}</Text>
                        </View>
                        <View style={styles.summarySheetRow}>
                          <Text style={styles.summarySheetLabel}>Price</Text>
                          <Text style={[styles.summarySheetValue, { color: Colors.primary, fontWeight: '900' }]}>{(activePkg.price).toLocaleString('en-US')} VND</Text>
                        </View>
                      </>
                    ) : null}
                  </View>
                )}
              </View>
            )}

            {/* ── Navigation buttons ─────────────────────────────────────────── */}
            <View style={styles.modalBtns}>
              {step > 1 ? (
                <Button
                  label="← Back"
                  onPress={() => setStep((s) => (s - 1) as WizardStep)}
                  variant="secondary"
                  size="lg"
                  style={{ flex: 1 }}
                />
              ) : (
                <Button label="Close" onPress={closeWizard} variant="secondary" size="lg" style={{ flex: 1 }} />
              )}
              {step === 1 && <Button label="Next →" onPress={goToStep2} size="lg" style={{ flex: 1 }} />}
              {step === 2 && <Button label="Next →" onPress={goToStep3} size="lg" style={{ flex: 1 }} />}
              {step === 3 && (
                <Button
                  label={bookingType === 'package' ? 'SUBSCRIBE PACKAGE' : 'CONFIRM BOOKING'}
                  onPress={handleCreate}
                  loading={creating}
                  size="lg"
                  style={{ flex: 1 }}
                />
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <BookingDateModal
        visible={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        onApply={(start, end) => {
          applyDateTime('start', start);
          applyDateTime('end', end);
        }}
        initialStart={startDateTime}
        initialEnd={endDateTime}
        isPackage={bookingType === 'package'}
        packageDuration={activePkg?.durationDays}
      />
    </>
  );
}
