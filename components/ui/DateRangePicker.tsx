import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import { styles } from '@/styles/components/DateRangePicker.styles';

export interface DateRangePickerProps {
  fromDate: Date | null;
  toDate: Date | null;
  onFromChange: (date: Date) => void;
  onToChange: (date: Date | null) => void;
}

function formatDate(date: Date | null): string {
  if (!date) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
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

interface CustomCalendarModalProps {
  visible: boolean;
  value: Date | null;
  onSelect: (date: Date) => void;
  onClose: () => void;
  minimumDate?: Date;
  maximumDate?: Date;
  title: string;
}

function CustomCalendarModal({
  visible,
  value,
  onSelect,
  onClose,
  minimumDate,
  maximumDate,
  title,
}: CustomCalendarModalProps) {
  const referenceDate = value ?? new Date();
  const [viewYear, setViewYear] = useState(referenceDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(referenceDate.getMonth());

  // Sync state when visible becomes true
  useEffect(() => {
    if (visible) {
      const d = value ?? new Date();
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [visible, value]);

  if (!visible) return null;

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

  // Pad to multiple of 7 to maintain grid alignment
  const totalCellsNeeded = Math.ceil(calCells.length / 7) * 7;
  while (calCells.length < totalCellsNeeded) {
    calCells.push(null);
  }

  const isSelected = (d: number) => {
    if (!value) return false;
    return (
      d === value.getDate() &&
      viewMonth === value.getMonth() &&
      viewYear === value.getFullYear()
    );
  };

  const isToday = (d: number) => {
    const now = new Date();
    return (
      d === now.getDate() &&
      viewMonth === now.getMonth() &&
      viewYear === now.getFullYear()
    );
  };

  const isDateDisabled = (day: number) => {
    const target = new Date(viewYear, viewMonth, day);
    target.setHours(0, 0, 0, 0);

    if (minimumDate) {
      const min = new Date(minimumDate);
      min.setHours(0, 0, 0, 0);
      if (target < min) return true;
    }
    if (maximumDate) {
      const max = new Date(maximumDate);
      max.setHours(0, 0, 0, 0);
      if (target > max) return true;
    }
    return false;
  };

  const handleSelectDay = (day: number) => {
    if (isDateDisabled(day)) return;
    const selectedDate = new Date(viewYear, viewMonth, day, 0, 0, 0, 0);
    onSelect(selectedDate);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.calendarSheet} onPress={() => {}}>
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalCalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

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

          {/* Day of Week Headers */}
          <View style={styles.dayHeaderRow}>
            {DAYS_SHORT.map((d) => (
              <Text key={d} style={styles.dayHeader}>
                {d}
              </Text>
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

                  const disabled = isDateDisabled(day);
                  const selected = isSelected(day);
                  const today = isToday(day);

                  return (
                    <TouchableOpacity
                      key={colIdx}
                      style={[
                        styles.dayCell,
                        selected && styles.selectedDayCell,
                        today && !selected && styles.todayCell,
                        disabled && styles.disabledDayCell,
                      ]}
                      onPress={() => handleSelectDay(day)}
                      disabled={disabled}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.dayCellText,
                          selected && styles.selectedDayCellText,
                          today && !selected && styles.todayCellText,
                          disabled && styles.disabledDayCellText,
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
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function DateRangePicker({
  fromDate,
  toDate,
  onFromChange,
  onToChange,
}: DateRangePickerProps) {
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  return (
    <View style={styles.container}>
      {/* From Date Input */}
      <View style={styles.inputWrapper}>
        <Text style={styles.label}>FROM</Text>
        <TouchableOpacity
          style={styles.field}
          onPress={() => setShowFromPicker(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="calendar-outline" size={16} color={Colors.textDim} />
          <Text style={[styles.valueText, !fromDate && styles.placeholderText]}>
            {fromDate ? formatDate(fromDate) : 'MM/DD/YYYY'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* To Date Input */}
      <View style={styles.inputWrapper}>
        <Text style={styles.label}>TO</Text>
        <View style={styles.fieldContainer}>
          <TouchableOpacity
            style={[styles.field, { flex: 1 }]}
            onPress={() => setShowToPicker(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={16} color={Colors.textDim} />
            <Text style={[styles.valueText, !toDate && styles.placeholderText]}>
              {toDate ? formatDate(toDate) : 'Today'}
            </Text>
          </TouchableOpacity>
          {toDate ? (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => onToChange(null)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={18} color={Colors.textDim} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Reusable Custom Calendar Modal for FROM */}
      <CustomCalendarModal
        visible={showFromPicker}
        value={fromDate}
        title="Select From Date"
        maximumDate={new Date()}
        onSelect={(date) => {
          onFromChange(date);
          setShowFromPicker(false);
        }}
        onClose={() => setShowFromPicker(false)}
      />

      {/* Reusable Custom Calendar Modal for TO */}
      <CustomCalendarModal
        visible={showToPicker}
        value={toDate}
        title="Select To Date"
        minimumDate={fromDate ?? undefined}
        onSelect={(date) => {
          onToChange(date);
          setShowToPicker(false);
        }}
        onClose={() => setShowToPicker(false)}
      />
    </View>
  );
}
