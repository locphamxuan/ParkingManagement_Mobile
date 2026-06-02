import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Pressable,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../store/authStore';
import {
  getManagerBuildings,
  getBuildingShifts,
  createShift as createShiftApi,
  updateShift as updateShiftApi,
  deleteShift as deleteShiftApi,
  getBuildingStaffShifts,
  getBuildingStaff,
  assignStaffShift,
  updateStaffShift as updateStaffShiftApi,
  deleteStaffShift as deleteStaffShiftApi,
  type ManagerBuilding,
  type BaseShift,
  type ShiftInput,
  type StaffMember,
  type StaffShift as StaffShiftType,
  type StaffShiftInput,
  type StaffShiftUpdateInput,
} from '../../../services/manager';
import { Colors, FontSize, Radius, Spacing } from '../../../constants/theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtTime(t: string | null | undefined): string {
  if (!t) return '—';
  if (/^\d{2}:\d{2}$/.test(t)) return t;
  const d = new Date(t);
  if (!isNaN(d.getTime()))
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return t;
}

function fmtDateLabel(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function staffName(s: string | StaffMember | null | undefined): string {
  if (!s) return 'Unknown';
  if (typeof s === 'string') return s;
  return s.fullName || s.email || 'Unknown';
}

function shiftLabel(s: string | BaseShift | null | undefined): string {
  if (!s) return 'Unknown';
  if (typeof s === 'string') return s;
  return s.name || s.code || 'Unknown';
}

function shiftTime(s: string | BaseShift | null | undefined): string {
  if (!s || typeof s === 'string') return '';
  if (!s.startTime || !s.endTime) return '';
  return `${fmtTime(s.startTime)} – ${fmtTime(s.endTime)}`;
}

function ssColor(status: string): string {
  switch (status) {
    case 'active': return Colors.success;
    case 'scheduled': return Colors.blue;
    case 'completed': return Colors.textMuted;
    case 'cancelled': return Colors.error;
    default: return Colors.textDim;
  }
}
function ssBg(status: string): string {
  switch (status) {
    case 'active': return Colors.successBg;
    case 'scheduled': return Colors.blueBg;
    case 'completed': return 'rgba(100,116,139,0.10)';
    case 'cancelled': return Colors.errorBg;
    default: return 'rgba(100,116,139,0.05)';
  }
}
function ssIcon(status: string): IoniconName {
  switch (status) {
    case 'active': return 'play-circle-outline';
    case 'scheduled': return 'time-outline';
    case 'completed': return 'checkmark-circle-outline';
    case 'cancelled': return 'close-circle-outline';
    default: return 'ellipse-outline';
  }
}

const STAFF_SHIFT_STATUSES = ['scheduled', 'active', 'completed', 'cancelled'] as const;
type StaffShiftStatus = (typeof STAFF_SHIFT_STATUSES)[number];

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: ssBg(status), borderColor: ssColor(status) }]}>
      <Ionicons name={ssIcon(status)} size={11} color={ssColor(status)} />
      <Text style={[styles.badgeText, { color: ssColor(status) }]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </View>
  );
}

// ─── Picker Modal (shared list picker) ───────────────────────────────────────

interface PickerOption { label: string; value: string }

interface PickerModalProps {
  visible: boolean;
  title: string;
  options: PickerOption[];
  selected: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}

function PickerModal({ visible, title, options, selected, onSelect, onClose }: PickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.pickerOverlay} onPress={onClose}>
        <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.pickerHandle} />
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close-outline" size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            style={styles.pickerList}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const sel = item.value === selected;
              return (
                <TouchableOpacity
                  style={[styles.pickerOption, sel && styles.pickerOptionSelected]}
                  onPress={() => { onSelect(item.value); onClose(); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerOptionText, sel && styles.pickerOptionTextSelected]} numberOfLines={1}>
                    {item.label}
                  </Text>
                  {sel && <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />}
                </TouchableOpacity>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

interface DeleteModalProps {
  visible: boolean;
  title: string;
  message: string;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteModal({ visible, title, message, deleting, onConfirm, onCancel }: DeleteModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.deleteOverlay} onPress={onCancel}>
        <Pressable style={styles.deleteSheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.deleteIconWrap}>
            <Ionicons name="trash-outline" size={28} color={Colors.error} />
          </View>
          <Text style={styles.deleteTitle}>{title}</Text>
          <Text style={styles.deleteMsg}>{message}</Text>
          <View style={styles.deleteActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={deleting} activeOpacity={0.7}>
              <Text style={styles.cancelBtnLabel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.destructBtn]} onPress={onConfirm} disabled={deleting} activeOpacity={0.8}>
              {deleting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.actionBtnLabel}>Delete</Text>}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Shift Form Modal (create / edit base shift) ──────────────────────────────

interface ShiftFormModalProps {
  visible: boolean;
  mode: 'create' | 'edit';
  initial?: BaseShift | null;
  saving: boolean;
  onSubmit: (input: ShiftInput) => void;
  onCancel: () => void;
}

function ShiftFormModal({ visible, mode, initial, saving, onSubmit, onCancel }: ShiftFormModalProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!visible) return;
    if (mode === 'edit' && initial) {
      setName(initial.name ?? '');
      setCode(initial.code ?? '');
      setStartTime(fmtTime(initial.startTime));
      setEndTime(fmtTime(initial.endTime));
      setIsActive(initial.isActive !== false);
    } else {
      setName(''); setCode(''); setStartTime(''); setEndTime(''); setIsActive(true);
    }
  }, [visible, mode, initial]);

  const timeOk = (t: string) => /^\d{2}:\d{2}$/.test(t);

  const handleSubmit = () => {
    const trimName = name.trim();
    const trimCode = code.trim().toUpperCase();
    if (!trimName) { Alert.alert('Validation', 'Shift name is required.'); return; }
    if (!trimCode) { Alert.alert('Validation', 'Shift code is required.'); return; }
    if (!timeOk(startTime)) { Alert.alert('Validation', 'Start time must be in HH:mm format (e.g. 06:00).'); return; }
    if (!timeOk(endTime)) { Alert.alert('Validation', 'End time must be in HH:mm format (e.g. 14:00).'); return; }
    onSubmit({ name: trimName, code: trimCode, startTime, endTime, isActive });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.formOverlay} onPress={onCancel}>
        <Pressable style={styles.formSheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.formHandle} />
          <Text style={styles.formTitle}>{mode === 'create' ? 'Add Shift' : 'Edit Shift'}</Text>

          <Text style={styles.fieldLabel}>Shift Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName}
            placeholder="e.g. Morning Shift" placeholderTextColor={Colors.textDim}
            maxLength={80} editable={!saving} />

          <Text style={styles.fieldLabel}>Code *</Text>
          <TextInput style={styles.input} value={code} onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="e.g. MORNING" placeholderTextColor={Colors.textDim}
            autoCapitalize="characters" maxLength={30} editable={!saving} />

          <View style={styles.timeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Start Time *</Text>
              <TextInput style={styles.input} value={startTime} onChangeText={setStartTime}
                placeholder="HH:mm" placeholderTextColor={Colors.textDim}
                keyboardType="numbers-and-punctuation" maxLength={5} editable={!saving} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>End Time *</Text>
              <TextInput style={styles.input} value={endTime} onChangeText={setEndTime}
                placeholder="HH:mm" placeholderTextColor={Colors.textDim}
                keyboardType="numbers-and-punctuation" maxLength={5} editable={!saving} />
            </View>
          </View>

          <TouchableOpacity style={styles.toggleRow} onPress={() => setIsActive(!isActive)} disabled={saving} activeOpacity={0.7}>
            <Text style={styles.toggleLabel}>Active</Text>
            <View style={[styles.toggle, isActive && styles.toggleOn]}>
              <View style={[styles.toggleThumb, isActive && styles.toggleThumbOn]} />
            </View>
          </TouchableOpacity>

          <View style={styles.formActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={saving} activeOpacity={0.7}>
              <Text style={styles.cancelBtnLabel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={handleSubmit} disabled={saving} activeOpacity={0.8}>
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.actionBtnLabel}>{mode === 'create' ? 'Create' : 'Save'}</Text>}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Assign Form Modal (create / edit staff-shift) ────────────────────────────

interface AssignFormModalProps {
  visible: boolean;
  mode: 'create' | 'edit';
  initial?: StaffShiftType | null;
  staffList: StaffMember[];
  shiftList: BaseShift[];
  saving: boolean;
  onSubmit: (input: StaffShiftInput | StaffShiftUpdateInput) => void;
  onCancel: () => void;
}

function AssignFormModal({ visible, mode, initial, staffList, shiftList, saving, onSubmit, onCancel }: AssignFormModalProps) {
  const [selStaff, setSelStaff] = useState('');
  const [selShift, setSelShift] = useState('');
  const [workDate, setWorkDate] = useState(todayStr());
  const [status, setStatus] = useState<StaffShiftStatus>('scheduled');
  const [note, setNote] = useState('');

  const [staffPickerOpen, setStaffPickerOpen] = useState(false);
  const [shiftPickerOpen, setShiftPickerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (mode === 'edit' && initial) {
      const sid = typeof initial.staff === 'string' ? initial.staff : initial.staff?._id ?? '';
      const shid = typeof initial.shift === 'string' ? initial.shift : (initial.shift as BaseShift)?._id ?? '';
      setSelStaff(sid);
      setSelShift(shid);
      setWorkDate(initial.workDate?.substring(0, 10) ?? todayStr());
      setStatus(initial.status ?? 'scheduled');
      setNote(initial.note ?? '');
    } else {
      setSelStaff(''); setSelShift(''); setWorkDate(todayStr());
      setStatus('scheduled'); setNote('');
    }
  }, [visible, mode, initial]);

  const staffOptions = useMemo<PickerOption[]>(
    () => staffList.map((s) => ({ label: `${s.fullName}${s.phone ? ` (${s.phone})` : ''}`, value: s._id })),
    [staffList],
  );
  const shiftOptions = useMemo<PickerOption[]>(
    () => shiftList.map((s) => ({ label: `${s.name} (${fmtTime(s.startTime)} – ${fmtTime(s.endTime)})`, value: s._id })),
    [shiftList],
  );
  const dateOptions = useMemo<PickerOption[]>(() => {
    const opts: PickerOption[] = [];
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    for (let i = 0; i < 14; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      const v = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const lbl = i === 0 ? `Today — ${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`
        : i === 1 ? `Tomorrow — ${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`
        : `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
      opts.push({ label: lbl, value: v });
    }
    return opts;
  }, []);

  const selStaffLabel = staffList.find((s) => s._id === selStaff)?.fullName ?? 'Select staff member';
  const selShiftLabel = (() => {
    const s = shiftList.find((x) => x._id === selShift);
    return s ? `${s.name} (${fmtTime(s.startTime)} – ${fmtTime(s.endTime)})` : 'Select shift';
  })();

  const handleSubmit = () => {
    if (!selStaff) { Alert.alert('Validation', 'Please select a staff member.'); return; }
    if (!selShift) { Alert.alert('Validation', 'Please select a shift.'); return; }
    if (!workDate) { Alert.alert('Validation', 'Please select a date.'); return; }
    const input: StaffShiftInput = { staff: selStaff, shift: selShift, workDate, status, note: note.trim() || undefined };
    onSubmit(input);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.formOverlay} onPress={onCancel}>
        <Pressable style={styles.formSheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.formHandle} />
          <Text style={styles.formTitle}>{mode === 'create' ? 'Assign Shift' : 'Edit Assignment'}</Text>

          {/* Staff */}
          <Text style={styles.fieldLabel}>Staff Member *</Text>
          <TouchableOpacity style={styles.selector} onPress={() => setStaffPickerOpen(true)} activeOpacity={0.7} disabled={saving}>
            <Ionicons name="person-outline" size={16} color={selStaff ? Colors.text : Colors.textDim} />
            <Text style={[styles.selectorText, !selStaff && styles.selectorPlaceholder]} numberOfLines={1}>{selStaffLabel}</Text>
            <Ionicons name="chevron-down-outline" size={14} color={Colors.textDim} />
          </TouchableOpacity>

          {/* Shift */}
          <Text style={styles.fieldLabel}>Shift *</Text>
          <TouchableOpacity style={styles.selector} onPress={() => setShiftPickerOpen(true)} activeOpacity={0.7} disabled={saving}>
            <Ionicons name="timer-outline" size={16} color={selShift ? Colors.text : Colors.textDim} />
            <Text style={[styles.selectorText, !selShift && styles.selectorPlaceholder]} numberOfLines={1}>{selShiftLabel}</Text>
            <Ionicons name="chevron-down-outline" size={14} color={Colors.textDim} />
          </TouchableOpacity>

          {/* Date */}
          <Text style={styles.fieldLabel}>Work Date *</Text>
          <TouchableOpacity style={styles.selector} onPress={() => setDatePickerOpen(true)} activeOpacity={0.7} disabled={saving}>
            <Ionicons name="calendar-outline" size={16} color={Colors.text} />
            <Text style={styles.selectorText} numberOfLines={1}>{fmtDateLabel(workDate)}</Text>
            {workDate === todayStr() && (
              <View style={styles.todayPill}><Text style={styles.todayPillText}>Today</Text></View>
            )}
            <Ionicons name="chevron-down-outline" size={14} color={Colors.textDim} />
          </TouchableOpacity>

          {/* Status (always shown — useful for both create and edit) */}
          <Text style={styles.fieldLabel}>Status</Text>
          <View style={styles.statusRow}>
            {STAFF_SHIFT_STATUSES.map((s) => (
              <TouchableOpacity key={s} style={[styles.statusChip, status === s && { borderColor: ssColor(s), backgroundColor: ssBg(s) }]}
                onPress={() => setStatus(s)} disabled={saving} activeOpacity={0.7}>
                <Text style={[styles.statusChipText, status === s && { color: ssColor(s) }]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Note */}
          <Text style={styles.fieldLabel}>Note (optional)</Text>
          <TextInput style={[styles.input, { height: 64 }]} value={note} onChangeText={setNote}
            placeholder="Internal note…" placeholderTextColor={Colors.textDim}
            multiline maxLength={300} editable={!saving} textAlignVertical="top" />

          <View style={styles.formActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={saving} activeOpacity={0.7}>
              <Text style={styles.cancelBtnLabel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={handleSubmit} disabled={saving} activeOpacity={0.8}>
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.actionBtnLabel}>{mode === 'create' ? 'Assign' : 'Save'}</Text>}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>

      {/* Nested pickers — rendered inside this modal so they layer on top */}
      <PickerModal visible={staffPickerOpen} title="Select Staff Member" options={staffOptions}
        selected={selStaff} onSelect={setSelStaff} onClose={() => setStaffPickerOpen(false)} />
      <PickerModal visible={shiftPickerOpen} title="Select Shift" options={shiftOptions}
        selected={selShift} onSelect={setSelShift} onClose={() => setShiftPickerOpen(false)} />
      <PickerModal visible={datePickerOpen} title="Select Date" options={dateOptions}
        selected={workDate} onSelect={setWorkDate} onClose={() => setDatePickerOpen(false)} />
    </Modal>
  );
}

// ─── Schedule Row ─────────────────────────────────────────────────────────────

interface ScheduleRowProps {
  staffShift: StaffShiftType;
  onEdit: () => void;
  onDelete: () => void;
}

function ScheduleRow({ staffShift, onEdit, onDelete }: ScheduleRowProps) {
  const sName = staffName(staffShift.staff);
  const sLabel = shiftLabel(staffShift.shift);
  const sTime = shiftTime(staffShift.shift);
  return (
    <View style={styles.scheduleRow}>
      <View style={styles.scheduleAvatar}>
        <Ionicons name="person-circle-outline" size={34} color={Colors.textMuted} />
      </View>
      <View style={styles.scheduleInfo}>
        <Text style={styles.scheduleStaff} numberOfLines={1}>{sName}</Text>
        <Text style={styles.scheduleShift} numberOfLines={1}>
          {sLabel}{sTime ? ` · ${sTime}` : ''}
        </Text>
      </View>
      <StatusBadge status={staffShift.status} />
      <TouchableOpacity style={styles.rowIconBtn} onPress={onEdit} hitSlop={8} activeOpacity={0.7}>
        <Ionicons name="pencil-outline" size={15} color={Colors.primary} />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.rowIconBtn, styles.rowIconBtnDanger]} onPress={onDelete} hitSlop={8} activeOpacity={0.7}>
        <Ionicons name="trash-outline" size={15} color={Colors.error} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Shift Card ───────────────────────────────────────────────────────────────

const SHIFT_ACCENT: Record<string, string> = {
  Morning: Colors.amber,
  Afternoon: Colors.blue,
  Night: Colors.purple,
};

interface ShiftCardProps {
  shift: BaseShift;
  onEdit: () => void;
  onDelete: () => void;
}

function ShiftCard({ shift, onEdit, onDelete }: ShiftCardProps) {
  const accent = SHIFT_ACCENT[shift.name] ?? Colors.primary;
  return (
    <View style={[styles.shiftCard, { borderLeftColor: accent }]}>
      <View style={styles.shiftCardLeft}>
        <View style={[styles.shiftDot, { backgroundColor: accent }]} />
        <View style={styles.shiftInfo}>
          <Text style={styles.shiftName}>{shift.name}</Text>
          <Text style={styles.shiftCode}>{shift.code}</Text>
        </View>
      </View>
      <View style={styles.shiftCardRight}>
        <Ionicons name="time-outline" size={15} color={accent} />
        <Text style={[styles.shiftTime, { color: accent }]}>
          {fmtTime(shift.startTime)} – {fmtTime(shift.endTime)}
        </Text>
        <TouchableOpacity style={styles.rowIconBtn} onPress={onEdit} hitSlop={8} activeOpacity={0.7}>
          <Ionicons name="pencil-outline" size={15} color={Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.rowIconBtn, styles.rowIconBtnDanger]} onPress={onDelete} hitSlop={8} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={15} color={Colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ShiftsScreen() {
  const { session } = useAuthStore();
  const token = session?.token ?? '';

  const [building, setBuilding] = useState<ManagerBuilding | null>(null);
  const [baseShifts, setBaseShifts] = useState<BaseShift[]>([]);
  const [staffShifts, setStaffShifts] = useState<StaffShiftType[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [viewDate, setViewDate] = useState(todayStr());

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Base shift CRUD modals
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [shiftFormMode, setShiftFormMode] = useState<'create' | 'edit'>('create');
  const [shiftFormTarget, setShiftFormTarget] = useState<BaseShift | null>(null);
  const [savingShift, setSavingShift] = useState(false);

  const [showDeleteShift, setShowDeleteShift] = useState(false);
  const [deleteShiftTarget, setDeleteShiftTarget] = useState<BaseShift | null>(null);
  const [deletingShift, setDeletingShift] = useState(false);

  // Staff-shift CRUD modals
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignFormMode, setAssignFormMode] = useState<'create' | 'edit'>('create');
  const [assignFormTarget, setAssignFormTarget] = useState<StaffShiftType | null>(null);
  const [savingAssign, setSavingAssign] = useState(false);

  const [showDeleteAssign, setShowDeleteAssign] = useState(false);
  const [deleteAssignTarget, setDeleteAssignTarget] = useState<StaffShiftType | null>(null);
  const [deletingAssign, setDeletingAssign] = useState(false);

  // Date picker
  const [datePicker, setDatePicker] = useState(false);

  const buildingId = building?._id ?? null;
  const viewDateRef = useRef(viewDate);
  viewDateRef.current = viewDate;

  // ── Date picker options (next 14 days) ──────────────────────────────────────

  const dateOptions = useMemo<PickerOption[]>(() => {
    const opts: PickerOption[] = [];
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    for (let i = 0; i < 14; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      const v = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const lbl = i === 0 ? `Today — ${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`
        : i === 1 ? `Tomorrow — ${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`
        : `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
      opts.push({ label: lbl, value: v });
    }
    return opts;
  }, []);

  // ── Fetch ───────────────────────────────────────────────────────────────────

  const fetchStaffShifts = useCallback(async (bldId: string, date: string) => {
    const res = await getBuildingStaffShifts(bldId, token, date);
    return Array.isArray(res.data?.data?.items) ? res.data.data.items : [];
  }, [token]);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      // 1. Building — guard both single-object and array shapes
      const buildRes = await getManagerBuildings(token);
      const rawBld = (buildRes as unknown as { data?: unknown })?.data;
      const bld: ManagerBuilding | null = Array.isArray(rawBld)
        ? ((rawBld as ManagerBuilding[])[0] ?? null)
        : ((rawBld as ManagerBuilding) ?? null);

      if (!bld?._id) {
        setBuilding(null); setBaseShifts([]); setStaffShifts([]); setStaffList([]);
        return;
      }
      setBuilding(bld);

      // 2. Base shifts, staff-shifts for current date, staff list — in parallel
      const [shiftsRes, ssItems, staffRes] = await Promise.all([
        getBuildingShifts(bld._id, token),
        fetchStaffShifts(bld._id, viewDateRef.current),
        getBuildingStaff(bld._id, token),
      ]);

      // CRASH-PROOF extraction
      setBaseShifts(Array.isArray(shiftsRes.data?.data?.items) ? shiftsRes.data.data.items : []);
      setStaffShifts(ssItems);
      setStaffList(Array.isArray(staffRes.data?.data?.items) ? staffRes.data.data.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedule data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, fetchStaffShifts]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchAll(); }, [fetchAll]);

  // Reload staff-shifts when date changes
  const onDateChange = useCallback(async (date: string) => {
    setViewDate(date);
    if (!buildingId) return;
    try {
      const items = await fetchStaffShifts(buildingId, date);
      setStaffShifts(items);
    } catch {
      setStaffShifts([]);
    }
  }, [buildingId, fetchStaffShifts]);

  // ── Base Shift CRUD ─────────────────────────────────────────────────────────

  const openCreateShift = () => {
    setShiftFormMode('create');
    setShiftFormTarget(null);
    setShowShiftForm(true);
  };

  const openEditShift = (s: BaseShift) => {
    setShiftFormMode('edit');
    setShiftFormTarget(s);
    setShowShiftForm(true);
  };

  const openDeleteShift = (s: BaseShift) => {
    setDeleteShiftTarget(s);
    setShowDeleteShift(true);
  };

  const handleSaveShift = useCallback(async (input: ShiftInput) => {
    if (!buildingId) return;
    setSavingShift(true);
    try {
      if (shiftFormMode === 'create') {
        await createShiftApi(buildingId, token, input);
      } else if (shiftFormTarget?._id) {
        await updateShiftApi(buildingId, shiftFormTarget._id, token, input);
      }
      setShowShiftForm(false);
      setShiftFormTarget(null);
      const res = await getBuildingShifts(buildingId, token);
      setBaseShifts(Array.isArray(res.data?.data?.items) ? res.data.data.items : []);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save shift.');
    } finally {
      setSavingShift(false);
    }
  }, [buildingId, token, shiftFormMode, shiftFormTarget]);

  const handleDeleteShift = useCallback(async () => {
    if (!buildingId || !deleteShiftTarget?._id) return;
    setDeletingShift(true);
    try {
      await deleteShiftApi(buildingId, deleteShiftTarget._id, token);
      setShowDeleteShift(false);
      setDeleteShiftTarget(null);
      const res = await getBuildingShifts(buildingId, token);
      setBaseShifts(Array.isArray(res.data?.data?.items) ? res.data.data.items : []);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete shift.');
    } finally {
      setDeletingShift(false);
    }
  }, [buildingId, deleteShiftTarget, token]);

  // ── Staff-Shift CRUD ────────────────────────────────────────────────────────

  const openAssign = () => {
    setAssignFormMode('create');
    setAssignFormTarget(null);
    setShowAssignForm(true);
  };

  const openEditAssign = (ss: StaffShiftType) => {
    setAssignFormMode('edit');
    setAssignFormTarget(ss);
    setShowAssignForm(true);
  };

  const openDeleteAssign = (ss: StaffShiftType) => {
    setDeleteAssignTarget(ss);
    setShowDeleteAssign(true);
  };

  const handleSaveAssign = useCallback(async (input: StaffShiftInput | StaffShiftUpdateInput) => {
    if (!buildingId) return;
    setSavingAssign(true);
    try {
      if (assignFormMode === 'create') {
        await assignStaffShift(buildingId, token, input as StaffShiftInput);
      } else if (assignFormTarget?._id) {
        await updateStaffShiftApi(buildingId, assignFormTarget._id, token, input as StaffShiftUpdateInput);
      }
      setShowAssignForm(false);
      setAssignFormTarget(null);
      const items = await fetchStaffShifts(buildingId, viewDateRef.current);
      setStaffShifts(items);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save assignment.');
    } finally {
      setSavingAssign(false);
    }
  }, [buildingId, token, assignFormMode, assignFormTarget, fetchStaffShifts]);

  const handleDeleteAssign = useCallback(async () => {
    if (!buildingId || !deleteAssignTarget?._id) return;
    setDeletingAssign(true);
    try {
      await deleteStaffShiftApi(buildingId, deleteAssignTarget._id, token);
      setShowDeleteAssign(false);
      setDeleteAssignTarget(null);
      const items = await fetchStaffShifts(buildingId, viewDateRef.current);
      setStaffShifts(items);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete assignment.');
    } finally {
      setDeletingAssign(false);
    }
  }, [buildingId, deleteAssignTarget, token, fetchStaffShifts]);

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading schedules…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />
          }
        >
          <View style={[styles.glow, { pointerEvents: 'none' }]} />

          {/* ── Error ──────────────────────────────────────────────────── */}
          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={fetchAll}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
            </View>
          )}

          {/* ── No building ────────────────────────────────────────────── */}
          {!building && (
            <View style={styles.emptyBox}>
              <Ionicons name="business-outline" size={48} color={Colors.textDim} />
              <Text style={styles.emptyTitle}>No Building Assigned</Text>
              <Text style={styles.emptyText}>You don't have a building assigned to your account yet.</Text>
            </View>
          )}

          {building && (
            <>
              {/* ── Section: Schedule ──────────────────────────────────── */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
                  <Text style={styles.sectionTitle}>Schedule</Text>
                  <Text style={styles.sectionCount}>{staffShifts.length} assigned</Text>
                  <TouchableOpacity style={styles.addBtn} onPress={openAssign} activeOpacity={0.75}>
                    <Ionicons name="add" size={15} color={Colors.primary} />
                    <Text style={styles.addBtnLabel}>Assign</Text>
                  </TouchableOpacity>
                </View>

                {/* Date selector */}
                <TouchableOpacity style={styles.datePill} onPress={() => setDatePicker(true)} activeOpacity={0.75}>
                  <Ionicons name="calendar-outline" size={15} color={Colors.primary} />
                  <Text style={styles.datePillText}>{fmtDateLabel(viewDate)}</Text>
                  {viewDate === todayStr() && (
                    <View style={styles.todayPill}><Text style={styles.todayPillText}>Today</Text></View>
                  )}
                  <Ionicons name="chevron-down-outline" size={14} color={Colors.textDim} />
                </TouchableOpacity>

                {staffShifts.length === 0 ? (
                  <View style={styles.emptyInner}>
                    <Ionicons name="people-outline" size={32} color={Colors.textDim} />
                    <Text style={styles.emptyInnerText}>No schedules for this date</Text>
                    <Text style={styles.emptyInnerHint}>Tap "Assign" to add one.</Text>
                  </View>
                ) : (
                  <View style={styles.list}>
                    {staffShifts.map((ss) => (
                      <ScheduleRow
                        key={ss._id}
                        staffShift={ss}
                        onEdit={() => openEditAssign(ss)}
                        onDelete={() => openDeleteAssign(ss)}
                      />
                    ))}
                  </View>
                )}
              </View>

              {/* ── Section: Shift Templates ──────────────────────────── */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="layers-outline" size={16} color={Colors.amber} />
                  <Text style={styles.sectionTitle}>Shift Templates</Text>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity style={styles.addBtn} onPress={openCreateShift} activeOpacity={0.75}>
                    <Ionicons name="add" size={15} color={Colors.primary} />
                    <Text style={styles.addBtnLabel}>Add Shift</Text>
                  </TouchableOpacity>
                </View>

                {baseShifts.length === 0 ? (
                  <View style={styles.emptyInner}>
                    <Ionicons name="timer-outline" size={32} color={Colors.textDim} />
                    <Text style={styles.emptyInnerText}>No shifts configured</Text>
                    <Text style={styles.emptyInnerHint}>Tap "Add Shift" to create one.</Text>
                  </View>
                ) : (
                  <View style={styles.list}>
                    {baseShifts.map((s) => (
                      <ShiftCard
                        key={s._id}
                        shift={s}
                        onEdit={() => openEditShift(s)}
                        onDelete={() => openDeleteShift(s)}
                      />
                    ))}
                  </View>
                )}
              </View>

              <View style={{ height: 24 }} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Date Picker ──────────────────────────────────────────────────── */}
      <PickerModal
        visible={datePicker}
        title="Select Date"
        options={dateOptions}
        selected={viewDate}
        onSelect={onDateChange}
        onClose={() => setDatePicker(false)}
      />

      {/* ── Shift Template Modals ─────────────────────────────────────────── */}
      <ShiftFormModal
        visible={showShiftForm}
        mode={shiftFormMode}
        initial={shiftFormTarget}
        saving={savingShift}
        onSubmit={handleSaveShift}
        onCancel={() => { if (!savingShift) { setShowShiftForm(false); setShiftFormTarget(null); } }}
      />
      <DeleteModal
        visible={showDeleteShift}
        title="Delete Shift"
        message={`Delete "${deleteShiftTarget?.name ?? ''}"? Existing assignments using this shift may be affected.`}
        deleting={deletingShift}
        onConfirm={handleDeleteShift}
        onCancel={() => { if (!deletingShift) { setShowDeleteShift(false); setDeleteShiftTarget(null); } }}
      />

      {/* ── Staff-Shift Assignment Modals ─────────────────────────────────── */}
      <AssignFormModal
        visible={showAssignForm}
        mode={assignFormMode}
        initial={assignFormTarget}
        staffList={staffList}
        shiftList={baseShifts}
        saving={savingAssign}
        onSubmit={handleSaveAssign}
        onCancel={() => { if (!savingAssign) { setShowAssignForm(false); setAssignFormTarget(null); } }}
      />
      <DeleteModal
        visible={showDeleteAssign}
        title="Remove Assignment"
        message={`Remove ${staffName(deleteAssignTarget?.staff)}'s assignment for this date?`}
        deleting={deletingAssign}
        onConfirm={handleDeleteAssign}
        onCancel={() => { if (!deletingAssign) { setShowDeleteAssign(false); setDeleteAssignTarget(null); } }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  loadingText: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '600' },
  scroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: 32, gap: Spacing.lg },
  glow: {
    position: 'absolute', top: -140, left: -100,
    width: 320, height: 320, borderRadius: 160,
    backgroundColor: 'rgba(249,115,22,0.05)',
  },

  // ── Error ──────────────────────────────────────────────────────────────────
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.errorBg, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.errorBorder, padding: Spacing.md,
  },
  errorText: { flex: 1, fontSize: FontSize.sm, color: Colors.error, fontWeight: '600' },
  retryText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '700' },

  // ── Empty ──────────────────────────────────────────────────────────────────
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing['3xl'], gap: Spacing.md },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.text },
  emptyText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: Spacing.xl },

  // ── Section ────────────────────────────────────────────────────────────────
  section: { gap: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.text },
  sectionCount: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textMuted },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.md, paddingVertical: 5,
    borderRadius: Radius.full, borderWidth: 1,
    borderColor: Colors.primary, backgroundColor: `${Colors.primary}14`,
  },
  addBtnLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },

  // ── Date pill ──────────────────────────────────────────────────────────────
  datePill: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.card, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  datePillText: { flex: 1, fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  todayPill: { backgroundColor: `${Colors.primary}20`, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  todayPillText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },

  // ── List containers ────────────────────────────────────────────────────────
  list: { gap: Spacing.sm },

  // ── Empty inner ────────────────────────────────────────────────────────────
  emptyInner: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing['2xl'], gap: Spacing.sm,
    backgroundColor: Colors.card, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border,
  },
  emptyInnerText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDim },
  emptyInnerHint: { fontSize: FontSize.xs, color: Colors.textMuted },

  // ── Badge ──────────────────────────────────────────────────────────────────
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: Radius.full, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Row icon buttons ───────────────────────────────────────────────────────
  rowIconBtn: {
    width: 30, height: 30, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: `${Colors.primary}35`,
    backgroundColor: `${Colors.primary}0d`,
  },
  rowIconBtnDanger: { borderColor: `${Colors.error}35`, backgroundColor: `${Colors.error}0d` },

  // ── Schedule row ───────────────────────────────────────────────────────────
  scheduleRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  scheduleAvatar: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.cardAlt,
  },
  scheduleInfo: { flex: 1, gap: 2 },
  scheduleStaff: { fontSize: FontSize.base, fontWeight: '700', color: Colors.text },
  scheduleShift: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textMuted },

  // ── Shift card ─────────────────────────────────────────────────────────────
  shiftCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    borderLeftWidth: 4, padding: Spacing.md, gap: Spacing.sm,
  },
  shiftCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  shiftDot: { width: 9, height: 9, borderRadius: 5 },
  shiftInfo: { flex: 1, gap: 2 },
  shiftName: { fontSize: FontSize.base, fontWeight: '700', color: Colors.text },
  shiftCode: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textDim, textTransform: 'uppercase', letterSpacing: 1 },
  shiftCardRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  shiftTime: { fontSize: FontSize.sm, fontWeight: '800' },

  // ── Status row (in assign form) ────────────────────────────────────────────
  statusRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  statusChip: {
    flex: 1, minWidth: 70, paddingVertical: 7,
    borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.cardAlt,
    alignItems: 'center',
  },
  statusChipText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },

  // ── Picker Modal ───────────────────────────────────────────────────────────
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    maxHeight: '60%', paddingBottom: 32,
  },
  pickerHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  pickerTitle: { fontSize: FontSize.md, fontWeight: '900', color: Colors.text },
  pickerList: { maxHeight: 320 },
  pickerOption: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, gap: Spacing.sm },
  pickerOptionSelected: { backgroundColor: `${Colors.primary}08` },
  pickerOptionText: { flex: 1, fontSize: FontSize.base, fontWeight: '600', color: Colors.text },
  pickerOptionTextSelected: { color: Colors.primary, fontWeight: '800' },

  // ── Delete modal ───────────────────────────────────────────────────────────
  deleteOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  deleteSheet: {
    width: '100%', backgroundColor: Colors.card,
    borderRadius: Radius.xl, padding: Spacing.xl,
    gap: Spacing.md, alignItems: 'center',
  },
  deleteIconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.errorBg, alignItems: 'center', justifyContent: 'center' },
  deleteTitle: { fontSize: FontSize.md, fontWeight: '900', color: Colors.text },
  deleteMsg: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  deleteActions: { flexDirection: 'row', gap: Spacing.sm, width: '100%' },

  // ── Form modal ─────────────────────────────────────────────────────────────
  formOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  formSheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.xl, paddingBottom: 40, gap: Spacing.md,
  },
  formHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.xs },
  formTitle: { fontSize: FontSize.md, fontWeight: '900', color: Colors.text, textAlign: 'center' },
  formActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },

  // ── Shared form fields ─────────────────────────────────────────────────────
  fieldLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textDim, textTransform: 'uppercase', letterSpacing: 1, marginBottom: -Spacing.xs },
  input: {
    backgroundColor: Colors.cardAlt, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.text, fontSize: FontSize.base,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  timeRow: { flexDirection: 'row', gap: Spacing.md },
  selector: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.cardAlt, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, height: 48,
  },
  selectorText: { flex: 1, fontSize: FontSize.base, fontWeight: '600', color: Colors.text },
  selectorPlaceholder: { color: Colors.textDim, fontWeight: '500' },

  // ── Toggle ─────────────────────────────────────────────────────────────────
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.xs },
  toggleLabel: { fontSize: FontSize.base, fontWeight: '600', color: Colors.text },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: Colors.cardAlt, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', paddingHorizontal: 2 },
  toggleOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.textDim },
  toggleThumbOn: { backgroundColor: '#fff', alignSelf: 'flex-end' },

  // ── Buttons ────────────────────────────────────────────────────────────────
  cancelBtn: {
    flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.cardAlt, alignItems: 'center',
  },
  cancelBtnLabel: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textMuted },
  actionBtn: {
    flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  destructBtn: { backgroundColor: Colors.error },
  actionBtnLabel: { fontSize: FontSize.base, fontWeight: '800', color: '#fff' },
});
