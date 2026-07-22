import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { styles } from '@/styles/components/BookingDateModal.styles';

type BookingMode = 'hourly' | 'daily';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface BookingCalendarProps {
  mode: BookingMode;
  isPackage?: boolean;
  selectionTarget: 'checkin' | 'checkout';
  viewMonth: number;
  viewYear: number;
  prevMonth: () => void;
  nextMonth: () => void;
  calCells: (number | null)[];
  getCellDate: (d: number | null) => Date | null;
  packageDuration?: number;
  isCheckin: (d: number | null) => boolean;
  isCheckout: (d: number | null) => boolean;
  isMiddleRange: (d: number | null) => boolean;
  handleSelectDay: (d: number) => void;
}

/** Phần lịch (banner mục tiêu chọn + điều hướng tháng + lưới ngày) của BookingDateModal. */
export function BookingCalendar({
  mode, isPackage, selectionTarget, viewMonth, viewYear, prevMonth, nextMonth,
  calCells, getCellDate, packageDuration, isCheckin, isCheckout, isMiddleRange, handleSelectDay,
}: BookingCalendarProps) {
  return (
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
  );
}
