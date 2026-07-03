import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing } from '../../constants/theme';
import { styles } from '../../styles/screens/reservations';
import { fmtDate, fmtVND } from '../../utils/reservationFormat';
import type { ReservationsVM } from '../../hooks/useReservations';

// Step 3 wizard — chọn thời gian, xem tóm tắt & ước tính phí/cọc, xác nhận.
export function WizardStep3({ vm }: { vm: ReservationsVM }) {
  const {
    plates,
    wizard,
    setShowBookingModal,
    bookingType, reserveDedicatedSlot,
    activePkg,
    selectedBuilding, selectedFloor, displaySlotCode, slots,
    startDateTime, endDateTime,
    feeEstimate, fetchingFee, estimatedFeeInfo,
    createError,
  } = vm;

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={styles.wizardScrollView}>
      <View style={{ gap: Spacing.md, paddingBottom: Spacing.lg }}>

        {/* Choose Date & Time Trigger Card */}
        <TouchableOpacity
          style={styles.timeTriggerCard}
          onPress={() => setShowBookingModal(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.timeTriggerLabel}>Booking Date & Time</Text>
            <Text style={styles.timeTriggerValue}>Choose Date & Time</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
        </TouchableOpacity>

        {/* Selected Time Preview */}
        <View style={styles.timePreviewCard}>
          <View style={styles.timePreviewColumn}>
            <Text style={styles.timePreviewLabel}>CHECK-IN</Text>
            <Text style={styles.timePreviewValue}>{fmtDate(startDateTime.toISOString())}</Text>
          </View>
          <View style={styles.timePreviewDivider} />
          <View style={styles.timePreviewColumn}>
            <Text style={styles.timePreviewLabel}>CHECK-OUT</Text>
            <Text style={styles.timePreviewValue}>
              {bookingType === 'package' && activePkg
                ? fmtDate(new Date(startDateTime.getTime() + activePkg.durationDays * 24 * 60 * 60 * 1000).toISOString())
                : fmtDate(endDateTime.toISOString())}
            </Text>
          </View>
        </View>

        {/* Reservation Summary */}
        <View style={styles.newSummaryCard}>
          <View style={styles.summaryHeader}>
            <Ionicons name="receipt-outline" size={16} color={Colors.primary} />
            <Text style={styles.newSummaryTitle}>Reservation Summary</Text>
          </View>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <View style={styles.summaryIconBox}>
                <Ionicons name="business-outline" size={16} color={Colors.textDim} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryItemLabel}>BUILDING</Text>
                <Text style={styles.summaryItemValue} numberOfLines={1}>
                  {selectedBuilding?.name ?? wizard.buildingId}
                </Text>
              </View>
            </View>

            <View style={styles.summaryItem}>
              <View style={styles.summaryIconBox}>
                <Ionicons name="car-outline" size={16} color={Colors.textDim} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryItemLabel}>VEHICLE & PLATE</Text>
                <Text style={styles.summaryItemValue} numberOfLines={1}>
                  {wizard.plateNumber}
                  {(() => {
                    const selectedPlate = plates.find((p) => p.plateNumber === wizard.plateNumber);
                    return selectedPlate
                      ? selectedPlate.vehicleType === 'car'
                        ? ' (🚗 Car)'
                        : ' (🏍️ Motorcycle)'
                      : '';
                  })()}
                </Text>
              </View>
            </View>

            {(!bookingType || bookingType === 'hourly' || reserveDedicatedSlot) ? (
              <View style={styles.summaryItem}>
                <View style={styles.summaryIconBox}>
                  <Ionicons name="location-outline" size={16} color={Colors.textDim} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryItemLabel}>PARKING SPOT</Text>
                  <Text style={styles.summaryItemValue}>
                    Floor {selectedFloor ? `${selectedFloor.name || selectedFloor.code}` : '—'} · Slot {displaySlotCode || slots.find((s) => s._id === wizard.slotId)?.code || wizard.slotId}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {bookingType === 'package' && activePkg ? (
          <View style={styles.billingCard}>
            <View style={styles.billingHeader}>
              <Ionicons name="wallet-outline" size={16} color={Colors.primary} />
              <Text style={styles.billingTitle}>Pricing Package</Text>
            </View>
            <View style={styles.billingRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="pricetag-outline" size={14} color={Colors.textDim} />
                <Text style={styles.billingLabel}>Package Price</Text>
              </View>
              <Text style={[styles.billingValue, { color: Colors.primary, fontWeight: '900' }]}>
                {(activePkg.price).toLocaleString('en-US')} VND
              </Text>
            </View>
          </View>
        ) : estimatedFeeInfo ? (
          <View style={styles.billingCard}>
            <View style={styles.billingHeader}>
              <Ionicons name="wallet-outline" size={16} color={Colors.primary} />
              <Text style={styles.billingTitle}>Fee Estimation</Text>
            </View>

            <View style={styles.billingRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="time-outline" size={14} color={Colors.textDim} />
                <Text style={styles.billingLabel}>Duration</Text>
              </View>
              <Text style={styles.billingValue}>{estimatedFeeInfo.duration}</Text>
            </View>

            {'rate' in estimatedFeeInfo && estimatedFeeInfo.rate ? (
              <View style={styles.billingRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="calculator-outline" size={14} color={Colors.textDim} />
                  <Text style={styles.billingLabel}>Rate Applied</Text>
                </View>
                <Text style={[styles.billingValue, { fontSize: FontSize.xs, textAlign: 'right', flex: 1 }]} numberOfLines={2}>
                  {estimatedFeeInfo.rate}
                </Text>
              </View>
            ) : null}

            <View style={styles.billingDivider} />

            {fetchingFee ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 8 }} />
            ) : (
              <>
                <View style={[styles.billingRow, styles.depositRow]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="wallet" size={15} color="#f59e0b" />
                    <Text style={[styles.billingLabel, { color: '#f59e0b', fontWeight: '800' }]}>Deposit Now ({feeEstimate?.depositPercent ?? 15}%)</Text>
                  </View>
                  <Text style={[styles.billingValue, { color: '#f59e0b', fontWeight: '900', fontSize: FontSize.md }]}>
                    {feeEstimate ? fmtVND(feeEstimate.depositAmount) : '—'}
                  </Text>
                </View>

                {feeEstimate && (
                  <View style={styles.billingRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="checkmark-circle-outline" size={14} color="#10b981" />
                      <Text style={styles.billingLabel}>Remaining at Checkout</Text>
                    </View>
                    <Text style={[styles.billingValue, { color: '#10b981', fontWeight: '700' }]}>
                      {fmtVND(feeEstimate.remainingFee)}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        ) : null}

        {createError ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={Colors.error} style={{ marginRight: 6 }} />
            <Text style={styles.errorText}>{createError}</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
