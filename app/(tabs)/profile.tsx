import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { updateProfile, changePassword } from '../../services/profile';
import { addPlate, removePlate, setDefaultPlate } from '../../services/plates';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import type { LicensePlate } from '../../types';

const MAX_PLATES = 3;
const PLATE_REGEX = /^\d{2}[A-Z]{1,2}-\d{3,5}$/;

function normalizePlate(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '-').replace(/[.]/g, '-');
}

type Tab = 'info' | 'plates' | 'password';

export default function ProfileScreen() {
  const { session, updateProfile: updateLocal, logout } = useAuthStore();
  const token = session?.token ?? '';

  const [tab, setTab] = useState<Tab>('info');

  // Profile edit
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [fullName, setFullName] = useState(session?.displayName ?? '');
  const [phone, setPhone] = useState(session?.phone ?? '');
  const [infoError, setInfoError] = useState<string | null>(null);
  const [infoSuccess, setInfoSuccess] = useState<string | null>(null);
  const [savingInfo, setSavingInfo] = useState(false);

  // Password change
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [savingPw, setSavingPw] = useState(false);

  // Plates
  const [plateInput, setPlateInput] = useState('');
  const [vehicleType, setVehicleType] = useState<'car' | 'motorcycle'>('car');
  const [plateError, setPlateError] = useState<string | null>(null);
  const [plateSuccess, setPlateSuccess] = useState<string | null>(null);
  const [loadingPlate, setLoadingPlate] = useState<string | null>(null);

  const plates = session?.licensePlates ?? [];

  // ── Profile Info save ─────────────────────────────────────────────────────
  const handleSaveInfo = async () => {
    setInfoError(null);
    if (!fullName.trim()) { setInfoError('Full name is required.'); return; }
    try {
      setSavingInfo(true);
      await updateProfile(token, { fullName: fullName.trim(), phone: phone.trim() });
      updateLocal({ displayName: fullName.trim(), phone: phone.trim() });
      setIsEditingInfo(false);
      setInfoSuccess('Profile updated!');
      setTimeout(() => setInfoSuccess(null), 3000);
    } catch (err) {
      setInfoError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSavingInfo(false);
    }
  };

  // ── Password change ────────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    setPwError(null);
    if (!currentPw) { setPwError('Current password is required.'); return; }
    if (newPw.length < 6) { setPwError('New password must be at least 6 characters.'); return; }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return; }
    try {
      setSavingPw(true);
      await changePassword(token, currentPw, newPw);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setPwSuccess('Password changed successfully!');
      setTimeout(() => setPwSuccess(null), 3000);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setSavingPw(false);
    }
  };

  // ── Plates ─────────────────────────────────────────────────────────────────
  const handleAddPlate = async () => {
    setPlateError(null);
    if (plates.length >= MAX_PLATES) {
      setPlateError(`Maximum ${MAX_PLATES} plates allowed.`);
      return;
    }
    const normalized = normalizePlate(plateInput);
    if (!PLATE_REGEX.test(normalized)) {
      setPlateError('Invalid format. Example: 29A-12345, 30AB-1234');
      return;
    }
    if (plates.some((p) => p.plateNumber.toUpperCase() === normalized)) {
      setPlateError('This plate is already added.');
      return;
    }
    try {
      setLoadingPlate('add');
      const updated = await addPlate(token, normalized, vehicleType);
      updateLocal({ licensePlates: updated });
      setPlateInput('');
      setPlateSuccess(`Added "${normalized}" successfully!`);
      setTimeout(() => setPlateSuccess(null), 2500);
    } catch (err) {
      setPlateError(err instanceof Error ? err.message : 'Failed to add plate');
    } finally {
      setLoadingPlate(null);
    }
  };

  const handleRemovePlate = (plate: LicensePlate) => {
    if (!plate._id) return;
    Alert.alert(
      'Remove Plate',
      `Remove license plate "${plate.plateNumber}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoadingPlate(plate._id!);
              const updated = await removePlate(token, plate._id!);
              updateLocal({ licensePlates: updated });
            } catch (err) {
              setPlateError(err instanceof Error ? err.message : 'Failed to remove plate');
            } finally {
              setLoadingPlate(null);
            }
          },
        },
      ],
    );
  };

  const handleSetDefault = async (plate: LicensePlate) => {
    if (!plate._id || plate.isDefault) return;
    try {
      setLoadingPlate(plate._id);
      const updated = await setDefaultPlate(token, plate._id);
      updateLocal({ licensePlates: updated });
    } catch (err) {
      setPlateError(err instanceof Error ? err.message : 'Failed to set default');
    } finally {
      setLoadingPlate(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(session?.displayName?.[0] ?? 'U').toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{session?.displayName}</Text>
              <Text style={styles.email}>{session?.email}</Text>
              <Badge label={session?.role ?? 'user'} variant="orange" />
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabRow}>
            {(['info', 'plates', 'password'] as Tab[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
                onPress={() => setTab(t)}
              >
                <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
                  {t === 'info' ? 'Info' : t === 'plates' ? 'Plates' : 'Password'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Tab: Info ─────────────────────────────────────────────────── */}
          {tab === 'info' && (
            <>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Personal Info</Text>
                  {!isEditingInfo && (
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => {
                        setFullName(session?.displayName ?? '');
                        setPhone(session?.phone ?? '');
                        setInfoError(null);
                        setIsEditingInfo(true);
                      }}
                    >
                      <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {infoSuccess ? (
                  <View style={styles.successBox}>
                    <Text style={styles.successText}>{ infoSuccess}</Text>
                  </View>
                ) : null}

                {isEditingInfo ? (
                  <View style={styles.formFields}>
                    <Input
                      label="Full Name"
                      value={fullName}
                      onChangeText={setFullName}
                      autoCapitalize="words"
                      error={infoError && infoError.includes('name') ? infoError : undefined}
                    />
                    <Input
                      label="Phone"
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      hint="Format: 0901234567"
                    />
                    <Input
                      label="Email"
                      value={session?.email ?? ''}
                      onChangeText={() => {}}
                      editable={false}
                      hint="Email cannot be changed"
                    />
                    {infoError ? (
                      <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{ infoError}</Text>
                      </View>
                    ) : null}
                    <View style={styles.btnRow}>
                      <Button
                        label="Save"
                        onPress={handleSaveInfo}
                        loading={savingInfo}
                        size="md"
                      />
                      <Button
                        label="Cancel"
                        onPress={() => setIsEditingInfo(false)}
                        variant="secondary"
                        size="md"
                      />
                    </View>
                  </View>
                ) : (
                  <View style={styles.infoList}>
                    {[
                      { label: 'Full Name', value: session?.displayName },
                      { label: 'Email', value: session?.email },
                      { label: 'Phone', value: session?.phone || '— Not set —' },
                      { label: 'Role', value: (session?.role ?? 'user').toUpperCase() },
                    ].map((item) => (
                      <View key={item.label} style={styles.infoRow}>
                        <Text style={styles.infoLabel}>{item.label}</Text>
                        <Text style={styles.infoValue}>{item.value}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* QR Code Check-in Card */}
              {session?.role?.toLowerCase() === 'user' && session?.userId ? (
                <View style={styles.qrCard}>
                  <View style={styles.qrCardHeader}>
                    <Text style={styles.qrCardTitle}>My QR Check-in</Text>
                    <Text style={styles.qrCardSubtitle}>
                      Scan at the gate card-reader to associate your parking session and pay with wallet.
                    </Text>
                  </View>
                  <View style={styles.qrCodeContainer}>
                    <Image
                      source={{
                        uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://pbms-parking.com/user/${session.userId}`,
                      }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={styles.qrInfoTag}>
                    <Text style={styles.qrIdText}>MEMBER ID: {session.userId}</Text>
                  </View>
                </View>
              ) : null}
            </>
          )}

          {/* ── Tab: Plates ───────────────────────────────────────────────── */}
          {tab === 'plates' && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>License Plates</Text>
                <Text style={styles.plateCount}>
                  {plates.length}/{MAX_PLATES}
                </Text>
              </View>

              {/* Capacity bar */}
              <View style={styles.capacityRow}>
                {Array.from({ length: MAX_PLATES }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.capacityBar,
                      i < plates.length && styles.capacityBarFilled,
                    ]}
                  />
                ))}
              </View>

              {/* Plate list */}
              <View style={styles.plateList}>
                {plates.length === 0 ? (
                  <Text style={styles.emptyText}>No license plates linked yet.</Text>
                ) : (
                  plates.map((plate) => (
                    <View key={plate.plateNumber} style={[
                      styles.plateItem,
                      plate.isDefault && styles.plateItemDefault,
                    ]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[
                          styles.plateNumber,
                          plate.isDefault && { color: Colors.amber },
                        ]}>
                          {plate.plateNumber}
                        </Text>
                        <Text style={styles.plateType}>
                          {plate.vehicleType === 'car' ? 'Car' : 'Motorcycle'}
                          {plate.isDefault ? ' · Default' : ''}
                        </Text>
                      </View>
                      <View style={styles.plateBtns}>
                        {!plate.isDefault && plate._id && (
                          <TouchableOpacity
                            style={styles.plateAction}
                            onPress={() => handleSetDefault(plate)}
                            disabled={loadingPlate === plate._id}
                          >
                            <Text style={styles.plateActionText}>★ Set default</Text>
                          </TouchableOpacity>
                        )}
                        {plate._id && (
                          <TouchableOpacity
                            style={[styles.plateAction, styles.plateActionDelete]}
                            onPress={() => handleRemovePlate(plate)}
                            disabled={loadingPlate === plate._id}
                          >
                            <Text style={styles.plateActionDeleteText}>✕</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </View>

              {/* Add plate form */}
              {plates.length < MAX_PLATES && (
                <View style={styles.addPlateForm}>
                  <Text style={styles.addPlateTitle}>Add Plate</Text>

                  {/* Vehicle type toggle */}
                  <View style={styles.typeToggle}>
                    <TouchableOpacity
                      style={[styles.typeBtn, vehicleType === 'car' && styles.typeBtnActive]}
                      onPress={() => setVehicleType('car')}
                    >
                      <Text style={[styles.typeBtnText, vehicleType === 'car' && styles.typeBtnTextActive]}>
                        Car
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.typeBtn, vehicleType === 'motorcycle' && styles.typeBtnActivePurple]}
                      onPress={() => setVehicleType('motorcycle')}
                    >
                      <Text style={[styles.typeBtnText, vehicleType === 'motorcycle' && styles.typeBtnTextPurple]}>
                        Motorcycle
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Input
                    placeholder="e.g. 29A-12345"
                    value={plateInput}
                    onChangeText={(t) => { setPlateInput(t.toUpperCase()); setPlateError(null); }}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    error={plateError ?? undefined}
                    hint="Format: 2 digits + 1-2 letters + dash + 3-5 digits"
                  />

                  {plateSuccess ? (
                    <View style={styles.successBox}>
                      <Text style={styles.successText}>{ plateSuccess}</Text>
                    </View>
                  ) : null}

                  <Button
                    label="Add Plate"
                    onPress={handleAddPlate}
                    loading={loadingPlate === 'add'}
                    size="md"
                  />
                </View>
              )}
            </View>
          )}

          {/* ── Tab: Password ─────────────────────────────────────────────── */}
          {tab === 'password' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Change Password</Text>

              <View style={styles.formFields}>
                <Input
                  label="Current Password"
                  value={currentPw}
                  onChangeText={setCurrentPw}
                  secureTextEntry
                  placeholder="Your current password"
                />
                <Input
                  label="New Password"
                  value={newPw}
                  onChangeText={setNewPw}
                  secureTextEntry
                  placeholder="At least 6 characters"
                />
                <Input
                  label="Confirm New Password"
                  value={confirmPw}
                  onChangeText={setConfirmPw}
                  secureTextEntry
                  placeholder="Repeat new password"
                />

                {pwError ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{ pwError}</Text>
                  </View>
                ) : null}

                {pwSuccess ? (
                  <View style={styles.successBox}>
                    <Text style={styles.successText}>{ pwSuccess}</Text>
                  </View>
                ) : null}

                <Button
                  label="Change Password"
                  onPress={handleChangePassword}
                  loading={savingPw}
                  size="md"
                />
              </View>
            </View>
          )}

          {/* Sign out */}
          <Button
            label="Sign Out"
            onPress={() => logout()}
            variant="danger"
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: 32,
    gap: Spacing.lg,
  },

  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(249,115,22,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSize.xl,
    fontWeight: '900',
    color: Colors.primary,
  },
  name: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.text },
  email: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 6 },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: 'rgba(249,115,22,0.15)' },
  tabBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted },
  tabBtnTextActive: { color: Colors.primary },

  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: { fontSize: FontSize.md, fontWeight: '900', color: Colors.text },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)',
  },
  editBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },

  formFields: { gap: Spacing.md },
  btnRow: { flexDirection: 'row', gap: Spacing.sm },

  infoList: { gap: Spacing.md },
  infoRow: {
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoValue: { fontSize: FontSize.base, fontWeight: '700', color: Colors.text },

  errorBox: {
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    padding: Spacing.md,
  },
  errorText: { color: Colors.error, fontSize: FontSize.sm, fontWeight: '600' },

  successBox: {
    backgroundColor: Colors.successBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.successBorder,
    padding: Spacing.md,
  },
  successText: { color: Colors.success, fontSize: FontSize.sm, fontWeight: '600' },

  // Plates
  plateCount: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: Colors.textDim,
  },
  capacityRow: {
    flexDirection: 'row',
    gap: 6,
  },
  capacityBar: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.cardAlt,
  },
  capacityBarFilled: {
    backgroundColor: Colors.primary,
  },
  plateList: { gap: Spacing.sm },
  emptyText: { color: Colors.textDim, fontSize: FontSize.sm, fontStyle: 'italic' },
  plateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  plateItemDefault: {
    borderColor: 'rgba(245,158,11,0.3)',
    backgroundColor: 'rgba(245,158,11,0.05)',
  },
  plateBtns: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  plateNumber: { fontSize: FontSize.base, fontWeight: '800', color: Colors.text, fontFamily: 'monospace' },
  plateType: { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 2 },
  plateAction: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
  },
  plateActionText: { fontSize: 10, color: Colors.amber, fontWeight: '700' },
  plateActionDelete: {
    backgroundColor: Colors.errorBg,
    borderColor: Colors.errorBorder,
  },
  plateActionDeleteText: { fontSize: 10, color: Colors.error, fontWeight: '800' },

  addPlateForm: {
    gap: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  addPlateTitle: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  typeToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.md,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  typeBtnActive: { backgroundColor: 'rgba(59,130,246,0.2)' },
  typeBtnActivePurple: { backgroundColor: 'rgba(168,85,247,0.2)' },
  typeBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted },
  typeBtnTextActive: { color: Colors.blue },
  typeBtnTextPurple: { color: Colors.purple },

  // QR Code Section Styles
  qrCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.2)',
    padding: Spacing.xl,
    gap: Spacing.md,
    alignItems: 'center',
  },
  qrCardHeader: {
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.xs,
  },
  qrCardTitle: {
    fontSize: FontSize.md,
    fontWeight: '900',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  qrCardSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.sm,
  },
  qrCodeContainer: {
    backgroundColor: '#ffffff',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  qrImage: {
    width: 180,
    height: 180,
  },
  qrInfoTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.2)',
    marginTop: Spacing.xs,
  },
  qrIdText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
  },
});
