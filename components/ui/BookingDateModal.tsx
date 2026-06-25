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
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import { styles } from './BookingDateModal.styles';

type BookingMode = 'hourly' | 'daily';

export interface BookingDateModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (start: Date, end: Date) => void;
  initialStart: Date;
  initialEnd: Date;
  isPackage?: boolean;
  packageDuration?: number;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const DAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

// Generates time slots from 00:00 to 23:30 (30-minute intervals)
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0');
  const m = i % 2 === 0 ? '00' : '30';
  return `${h}:${m}`;
});

// Helper: format date for display
function fmtDisplayDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}, ${d}/${m}/${y}`;
}

export function BookingDateModal({
  visible,
  onClose,
  onApply,
  initialStart,
  initialEnd,
  isPackage,
  packageDuration,
}: BookingDateModalProps) {
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
      // Switch Hourly -> Daily: keep check-in hour/minute, auto check-out (default to 7 days)
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
      end.setDate(end.getDate() + 7);
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

  const isTimeSlotPast = (timeStr: string): boolean => {
    const today = new Date();
    if (checkinDate.toDateString() === today.toDateString()) {
      const [hStr, mStr] = timeStr.split(':');
      const slotHour = parseInt(hStr, 10);
      const slotMin = parseInt(mStr, 10);

      const slotDate = new Date(today);
      slotDate.setHours(slotHour, slotMin, 0, 0);

      // Backend allows up to 1 hour grace buffer (slotTime must be >= now - 1 hour)
      const allowedTime = new Date(today.getTime() - 60 * 60 * 1000);
      return slotDate < allowedTime;
    }
    return false;
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

      if (mode === 'hourly') {
        const maxCheckinDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        return clickedDate > maxCheckinDate;
      }

      if (selectionTarget === 'checkin') {
        const maxCheckinDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        return clickedDate > maxCheckinDate;
      } else {
        if (clickedDate < checkinDate) {
          const maxCheckinDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
          return clickedDate > maxCheckinDate;
        } else {
          const maxCheckoutDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
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
        end.setDate(end.getDate() + 7);
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
      end.setDate(end.getDate() + 7);
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
            <View style={styles.calendarSection}>
              {/* Active selection banner for daily mode */}
              {mode !== 'hourly' && (
                <View style={styles.activeSelectionBanner}>
                  <Ionicons
                    name={isPackage ? "calendar-outline" : (selectionTarget === 'checkin' ? "log-in-outline" : "log-out-outline")}
                    size={16}
                    color={Colors.primary}
                  />
                  <Text style={styles.activeSelectionText}>
                    {isPackage
                      ? 'Select package start date'
                      : (selectionTarget === 'checkin' ? 'Selecting Check-in Date' : 'Selecting Check-out Date')}
                  </Text>
                </View>
              )}

              {/* Month Navigation */}
              <View style={styles.monthNav}>
                <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
                  <Ionicons name="chevron-back" size={18} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.monthLabel}>
                  {MONTHS[viewMonth]} {viewYear}
                </Text>
                <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
                  <Ionicons name="chevron-forward" size={18} color={Colors.text} />
                </TouchableOpacity>
              </View>

              {/* Day headers */}
              <View style={styles.dayHeaderRow}>
                {DAYS_SHORT.map((d) => (
                  <Text key={d} style={styles.dayHeader}>{d}</Text>
                ))}
              </View>

              {/* Calendar Grid */}
              <View style={styles.calGrid}>
                {Array.from({ length: calCells.length / 7 }, (_, rowIdx) => (
                  <View key={rowIdx} style={styles.calRow}>
                    {calCells.slice(rowIdx * 7, rowIdx * 7 + 7).map((day, colIdx) => {
                      if (day === null) {
                        return <View key={colIdx} style={styles.dayCell} />;
                      }

                      const date = getCellDate(day);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);

                      const isDisabled = (() => {
                        if (!date) return true;
                        if (date < today) return true;

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
                          return date > resolvedMaxDate;
                        }

                        if (mode === 'hourly') {
                          const maxCheckinDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
                          return date > maxCheckinDate;
                        }

                        const maxDailyDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
                        return date > maxDailyDate;
                      })();

                      const checkin = isCheckin(day);
                      const checkout = isCheckout(day);
                      const middle = isMiddleRange(day);

                      return (
                        <TouchableOpacity
                          key={colIdx}
                          style={[
                            styles.dayCell,
                            checkin && styles.checkinCell,
                            checkout && styles.checkoutCell,
                            middle && styles.middleCell,
                            isDisabled && styles.disabledCell,
                          ]}
                          onPress={() => handleSelectDay(day)}
                          disabled={!!isDisabled}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.dayCellText,
                              (checkin || checkout) && styles.selectedDayText,
                              middle && styles.middleRangeText,
                              isDisabled && styles.disabledText,
                            ]}
                          >
                            {day}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>

            {/* Hourly Booking Fields */}
            {(mode === 'hourly' || isPackage) && (
              <View style={styles.modeSection}>
                <Text style={styles.noteText}>
                  * Check-in date is only available within 7 days from today.
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
                      const isPastTime = isTimeSlotPast(time);
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
                      {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => {
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

                    <Text style={styles.sectionTitle}>Quick duration</Text>
                    <View style={styles.quickDurationContainer}>
                      <TouchableOpacity
                        style={[styles.quickDurationBtn]}
                        onPress={() => handleQuickSelectFromHourly(7)}
                      >
                        <Text style={styles.quickDurationBtnText}>7 days</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.quickDurationBtn]}
                        onPress={() => handleQuickSelectFromHourly(30)}
                      >
                        <Text style={styles.quickDurationBtnText}>30 days</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Daily Booking Fields */}
            {mode !== 'hourly' && !isPackage && (
              <View style={styles.modeSection}>
                <Text style={styles.noteText}>
                  * Check-in date is only available within 7 days from today.
                </Text>
                <Text style={styles.noteText}>
                  * If you want to park more than 30 days, please use Long-term Package subscription.
                </Text>
                <Text style={styles.sectionTitle}>Quick Endurances</Text>
                <View style={styles.quickDurationContainer}>
                  <TouchableOpacity
                    style={[styles.quickDurationBtn]}
                    onPress={() => applyQuickDuration(7)}
                  >
                    <Text style={styles.quickDurationBtnText}>7 days</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.quickDurationBtn]}
                    onPress={() => applyQuickDuration(30)}
                  >
                    <Text style={styles.quickDurationBtnText}>30 days</Text>
                  </TouchableOpacity>
                </View>
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
