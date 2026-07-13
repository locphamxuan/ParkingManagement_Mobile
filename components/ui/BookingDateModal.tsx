import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../constants/theme';
import { styles } from './BookingDateModal.styles';
import { BookingCalendar } from './BookingCalendar';
import { getDaysInMonth, getFirstDayOfMonth, TIME_SLOTS, fmtDisplayDate, policyLimits, isTimeSlotPast } from './BookingDateModal.utils';

type BookingMode = 'hourly' | 'daily';

export interface BookingDateModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (start: Date, end: Date) => void;
  initialStart: Date;
  initialEnd: Date;
  isPackage?: boolean;
  packageDuration?: number;
  /** Số ngày tối đa được đặt trước — từ ReservationPolicy của tòa (GET /users/reservations/policy). */
  maxAdvanceDays?: number;
  /** Số giờ tối đa của một lượt đặt — từ ReservationPolicy của tòa. */
  maxDurationHours?: number;
}

// Constants/helpers moved to ./BookingDateModal.utils and ./BookingCalendar

export function BookingDateModal({
  visible,
  onClose,
  onApply,
  initialStart,
  initialEnd,
  isPackage,
  packageDuration,
  maxAdvanceDays,
  maxDurationHours,
}: BookingDateModalProps) {
  // Giới hạn theo ReservationPolicy của tòa (fallback = hành vi cũ).
  const { advanceDays, durationDays, hourChipMax, defaultDailySpan, quickDays } =
    policyLimits(maxAdvanceDays, maxDurationHours);

  // Tabs & Settings State
  const [mode, setMode] = useState<BookingMode>('hourly');

  // Dates state (separate from parent until Apply is clicked)
  const [checkinDate, setCheckinDate] = useState<Date>(new Date());
  const [checkoutDate, setCheckoutDate] = useState<Date | null>(null);

  // Hourly state
  const [checkinTime, setCheckinTime] = useState<string>('08:00');
  const [hourDuration, setHourDuration] = useState<number>(1);

  // Remembered last hourly selections to prevent resetting
  const [lastHourlyTime, setLastHourlyTime] = useState<string>('');
  const [lastHourlyDuration, setLastHourlyDuration] = useState<number>(0);
  const [lastHourlyCheckinDate, setLastHourlyCheckinDate] = useState<Date | null>(null);

  // Calendar month view state
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [selectionTarget, setSelectionTarget] = useState<'checkin' | 'checkout'>('checkout');

  // Initialize/Reset state when modal opens
  useEffect(() => {
    if (visible) {
      const start = new Date(initialStart);
      const end = new Date(initialEnd);

      setCheckinDate(start);
      if (isPackage) {
        setCheckinTime('00:00');
        setMode('daily');
        setCheckoutDate(null);
      } else {
        const startHourStr = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
        setCheckinTime(startHourStr);
        const diffHrs = (end.getTime() - start.getTime()) / 3600000;

        if (diffHrs <= 24) {
          setMode('hourly');
          setCheckoutDate(end);
          setHourDuration(Math.max(1, Math.round(diffHrs)));
          // Save initial hourly selection
          setLastHourlyCheckinDate(start);
          setLastHourlyTime(startHourStr);
          setLastHourlyDuration(Math.max(1, Math.round(diffHrs)));
        } else {
          setMode('daily');
          setCheckoutDate(end);
        }
      }

      setViewYear(start.getFullYear());
      setViewMonth(start.getMonth());
      setSelectionTarget('checkout');
    }
  }, [visible, initialStart, initialEnd, isPackage]);

  // Sync / Calculate check-out based on changes
  useEffect(() => {
    if (mode === 'hourly') {
      const [hStr, mStr] = checkinTime.split(':');
      const start = new Date(checkinDate);
      start.setHours(parseInt(hStr, 10), parseInt(mStr, 10), 0, 0);

      const end = new Date(start.getTime() + hourDuration * 3600000);
      setCheckoutDate(end);
    }
  }, [checkinDate, checkinTime, hourDuration, mode]);

  // Tab switching rules
  const handleTabChange = (newMode: BookingMode) => {
    if (newMode === mode) return;

    if (newMode === 'hourly') {
      // Restore last hourly selection if present
      if (lastHourlyCheckinDate && lastHourlyTime && lastHourlyDuration) {
        setCheckinDate(lastHourlyCheckinDate);
        setCheckinTime(lastHourlyTime);
        setHourDuration(lastHourlyDuration);
      } else {
        // Fallback: nearest valid time +1 hour
        const now = new Date();
        now.setMinutes(now.getMinutes() > 30 ? 0 : 30, 0, 0);
        if (now.getMinutes() === 0) now.setHours(now.getHours() + 1);

        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        setCheckinDate(new Date());
        setCheckinTime(timeStr);
        setHourDuration(1);
      }
    } else {
      // Switch Hourly -> Daily: keep check-in hour/minute, auto check-out (default span theo policy)
      if (mode === 'hourly') {
        // Store current hourly state before leaving
        setLastHourlyCheckinDate(checkinDate);
        setLastHourlyTime(checkinTime);
        setLastHourlyDuration(hourDuration);
      }

      const [hStr, mStr] = checkinTime.split(':');
      const start = new Date(checkinDate);
      start.setHours(parseInt(hStr, 10), parseInt(mStr, 10), 0, 0);

      const end = new Date(start);
      end.setDate(end.getDate() + defaultDailySpan);
      setCheckoutDate(end);
    }

    setMode(newMode);
  };

  const applyQuickDuration = (days: number) => {
    const [hStr, mStr] = checkinTime.split(':');
    const start = new Date(checkinDate);
    start.setHours(parseInt(hStr, 10), parseInt(mStr, 10), 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + days);
    setCheckoutDate(end);
  };

  const handleQuickSelectFromHourly = (days: number) => {
    handleTabChange('daily');
    applyQuickDuration(days);
  };

  // Calendar calculation
  const prevMonth = () => {
    const nm = viewMonth === 0 ? 11 : viewMonth - 1;
    const ny = viewMonth === 0 ? viewYear - 1 : viewYear;
    setViewMonth(nm);
    setViewYear(ny);
  };

  const nextMonth = () => {
    const nm = viewMonth === 11 ? 0 : viewMonth + 1;
    const ny = viewMonth === 11 ? viewYear + 1 : viewYear;
    setViewMonth(nm);
    setViewYear(ny);
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const calCells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calCells.push(d);

  const totalCellsNeeded = Math.ceil(calCells.length / 7) * 7;
  while (calCells.length < totalCellsNeeded) {
    calCells.push(null);
  }

  // Range and selection checks
  const getCellDate = (d: number | null): Date | null => {
    if (d === null) return null;
    return new Date(viewYear, viewMonth, d, 0, 0, 0, 0);
  };

  const isCheckin = (d: number | null) => {
    if (d === null) return false;
    const date = getCellDate(d);
    return date?.toDateString() === checkinDate.toDateString();
  };

  const isCheckout = (d: number | null) => {
    if (d === null || !checkoutDate) return false;
    const date = getCellDate(d);
    return date?.toDateString() === checkoutDate.toDateString();
  };

  const isMiddleRange = (d: number | null) => {
    if (d === null || !checkoutDate) return false;
    const date = getCellDate(d);
    if (!date) return false;

    const startCompare = new Date(checkinDate);
    startCompare.setHours(0, 0, 0, 0);
    const endCompare = new Date(checkoutDate);
    endCompare.setHours(0, 0, 0, 0);

    return date > startCompare && date < endCompare;
  };

  const handleSelectDay = (d: number) => {
    const clickedDate = new Date(viewYear, viewMonth, d, 0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isDisabled = (() => {
      if (clickedDate < today) return true;

      if (isPackage && packageDuration) {
        const resolvedMaxDate = (() => {
          if (packageDuration <= 7) {
            return new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
          } else if (packageDuration <= 30) {
            return new Date(today.getFullYear(), today.getMonth() + 2, 0, 23, 59, 59, 999);
          } else {
            return new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
          }
        })();
        return clickedDate > resolvedMaxDate;
      }

      // Ngày check-in giới hạn theo maxAdvanceDays; check-out theo maxDurationHours (tính từ check-in).
      const maxCheckinDate = new Date(today.getTime() + advanceDays * 24 * 60 * 60 * 1000);

      if (mode === 'hourly') {
        return clickedDate > maxCheckinDate;
      }

      if (selectionTarget === 'checkin') {
        return clickedDate > maxCheckinDate;
      } else {
        if (clickedDate < checkinDate) {
          return clickedDate > maxCheckinDate;
        } else {
          const checkinDay = new Date(checkinDate);
          checkinDay.setHours(0, 0, 0, 0);
          const maxCheckoutDate = new Date(checkinDay.getTime() + durationDays * 24 * 60 * 60 * 1000);
          return clickedDate > maxCheckoutDate;
        }
      }
    })();

    if (isDisabled) return;

    if (isPackage) {
      setCheckinDate(clickedDate);
      setCheckoutDate(null);
    } else if (mode === 'hourly') {
      setCheckinDate(clickedDate);
    } else {
      // Daily range selection
      if (selectionTarget === 'checkin') {
        setCheckinDate(clickedDate);
        setCheckoutDate(null);
        setSelectionTarget('checkout');
      } else { // selectionTarget === 'checkout'
        if (clickedDate < checkinDate) {
          setCheckinDate(clickedDate);
          setCheckoutDate(null);
          setSelectionTarget('checkout');
        } else {
          // Keep check-in hour/minute for check-out
          const [hStr, mStr] = checkinTime.split(':');
          const finalCheckout = new Date(clickedDate);
          finalCheckout.setHours(parseInt(hStr, 10), parseInt(mStr, 10), 0, 0);
          setCheckoutDate(finalCheckout);
          setSelectionTarget('checkin');
        }
      }
    }
  };

  const clearSelection = () => {
    setCheckinDate(new Date());
    setCheckoutDate(null);
    setSelectionTarget('checkin');
  };

  const handleApply = () => {
    const [hStr, mStr] = checkinTime.split(':');
    const start = new Date(checkinDate);
    start.setHours(parseInt(hStr, 10), parseInt(mStr, 10), 0, 0);

    let end: Date;
    if (isPackage && packageDuration) {
      end = new Date(start.getTime() + packageDuration * 24 * 60 * 60 * 1000);
    } else if (mode === 'hourly') {
      end = new Date(start.getTime() + hourDuration * 3600000);
    } else {
      if (!checkoutDate) {
        // Standard fallback if user only selected check-in date
        end = new Date(start);
        end.setDate(end.getDate() + defaultDailySpan);
      } else {
        end = new Date(checkoutDate);
      }
    }

    if (end <= start) {
      alert('Checkout time must be after check-in time.');
      return;
    }

    onApply(start, end);
    onClose();
  };

  // Compile check-in / check-out display values for live preview
  const previewStart = (() => {
    const [hStr, mStr] = checkinTime.split(':');
    const start = new Date(checkinDate);
    start.setHours(parseInt(hStr, 10), parseInt(mStr, 10), 0, 0);
    return start;
  })();

  const previewEnd = (() => {
    if (mode === 'hourly') {
      return new Date(previewStart.getTime() + hourDuration * 3600000);
    } else {
      if (checkoutDate) return checkoutDate;
      // Fallback
      const end = new Date(previewStart);
      end.setDate(end.getDate() + defaultDailySpan);
      return end;
    }
  })();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.dismissArea} onPress={onClose} />

        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.modalHandle} />
            <View style={styles.headerTitleRow}>
              <Text style={styles.title}>Choose Booking Period</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Mode tabs */}
            {!isPackage && (
              <View style={styles.tabs}>
                {(['hourly', 'daily'] as BookingMode[]).map((tab) => {
                  const isActive = mode === tab;
                  const label = tab === 'hourly' ? 'Hourly' : 'Daily';
                  return (
                    <TouchableOpacity
                      key={tab}
                      style={[styles.tab, isActive && styles.tabActive]}
                      onPress={() => handleTabChange(tab)}
                    >
                      <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Calendar Component */}
            <BookingCalendar
              mode={mode}
              isPackage={isPackage}
              selectionTarget={selectionTarget}
              viewMonth={viewMonth}
              viewYear={viewYear}
              prevMonth={prevMonth}
              nextMonth={nextMonth}
              calCells={calCells}
              getCellDate={getCellDate}
              packageDuration={packageDuration}
              isCheckin={isCheckin}
              isCheckout={isCheckout}
              isMiddleRange={isMiddleRange}
              handleSelectDay={handleSelectDay}
            />

            {/* Hourly Booking Fields */}
            {(mode === 'hourly' || isPackage) && (
              <View style={styles.modeSection}>
                <Text style={styles.noteText}>
                  * Check-in date is only available within {advanceDays} days from today.
                </Text>
                <Text style={styles.sectionTitle}>Check in time</Text>
                {isPackage ? (
                  <View style={{ opacity: 0.65 }}>
                    <View style={[styles.chipScroll, { flexDirection: 'row' }]}>
                      <View style={[styles.chip, styles.chipActive, { borderColor: 'rgba(255,255,255,0.08)' }]}>
                        <Text style={[styles.chipText, styles.chipTextActive, { fontWeight: '800' }]}>
                          00:00 (Default)
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.noteText, { marginTop: Spacing.sm, color: Colors.primary, fontStyle: 'italic', lineHeight: 16 }]}>
                      * Long-term subscription packages allow unlimited 24/7 entry and exit. The start time is set by default to 00:00 on the active date to help you maximize your parking day.
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipScroll}
                  >
                    {TIME_SLOTS.map((time) => {
                      const isSelected = checkinTime === time;
                      const isPastTime = isTimeSlotPast(checkinDate, time);
                      return (
                        <TouchableOpacity
                          key={time}
                          style={[
                            styles.chip,
                            isSelected && styles.chipActive,
                            isPastTime && { opacity: 0.35, backgroundColor: Colors.border }
                          ]}
                          onPress={() => setCheckinTime(time)}
                          disabled={isPastTime}
                        >
                          <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                            {time}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}

                {!isPackage && (
                  <>
                    <Text style={styles.sectionTitle}>Parking time</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.chipScroll}
                    >
                      {Array.from({ length: hourChipMax }, (_, i) => i + 1).map((h) => {
                        const isSelected = hourDuration === h;
                        return (
                          <TouchableOpacity
                            key={h}
                            style={[styles.chip, isSelected && styles.chipActive]}
                            onPress={() => setHourDuration(h)}
                          >
                            <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                              {h} hours
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    {quickDays.length > 0 && (
                      <>
                        <Text style={styles.sectionTitle}>Quick duration</Text>
                        <View style={styles.quickDurationContainer}>
                          {quickDays.map((d) => (
                            <TouchableOpacity
                              key={d}
                              style={[styles.quickDurationBtn]}
                              onPress={() => handleQuickSelectFromHourly(d)}
                            >
                              <Text style={styles.quickDurationBtnText}>{d} days</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </>
                    )}
                  </>
                )}
              </View>
            )}

            {/* Daily Booking Fields */}
            {mode !== 'hourly' && !isPackage && (
              <View style={styles.modeSection}>
                <Text style={styles.noteText}>
                  * Check-in date is only available within {advanceDays} days from today.
                </Text>
                <Text style={styles.noteText}>
                  * If you want to park more than {durationDays} days, please use Long-term Package subscription.
                </Text>
                {quickDays.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>Quick durations</Text>
                    <View style={styles.quickDurationContainer}>
                      {quickDays.map((d) => (
                        <TouchableOpacity
                          key={d}
                          style={[styles.quickDurationBtn]}
                          onPress={() => applyQuickDuration(d)}
                        >
                          <Text style={styles.quickDurationBtnText}>{d} days</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Clear Button */}
            <TouchableOpacity onPress={clearSelection} style={styles.clearBtn}>
              <Ionicons name="trash-outline" size={14} color={Colors.error} />
              <Text style={styles.clearBtnText}>Clear Selection</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Bottom Preview & Actions */}
          <View style={styles.footer}>
            <View style={styles.previewContainer}>
              <View style={[
                styles.previewColumn,
                !isPackage && mode !== 'hourly' && selectionTarget === 'checkin' && styles.previewColumnActive
              ]}>
                <Text style={styles.previewLabel}>{isPackage ? 'Start' : 'Check in'}</Text>
                <Text style={styles.previewVal}>{fmtDisplayDate(previewStart)}</Text>
              </View>
              <View style={styles.previewDivider} />
              <View style={[
                styles.previewColumn,
                !isPackage && mode !== 'hourly' && selectionTarget === 'checkout' && styles.previewColumnActive
              ]}>
                <Text style={styles.previewLabel}>{isPackage ? 'End' : 'Check out'}</Text>
                <Text style={styles.previewVal}>
                  {isPackage && packageDuration
                    ? fmtDisplayDate(new Date(previewStart.getTime() + packageDuration * 24 * 60 * 60 * 1000))
                    : fmtDisplayDate(previewEnd)}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
              <Text style={styles.applyBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
