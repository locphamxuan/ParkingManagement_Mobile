import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { updateProfile, changePassword } from '../../services/profile';
import { addPlate, removePlate, setDefaultPlate } from '../../services/plates';
import { VEHICLE_PRESETS, PLATE_TYPE_LABELS } from '../../constants/vehiclePresets';
import type { PlateVehicleType } from '../../types';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import { styles } from '../../styles/screens/profile';
import type { LicensePlate } from '../../types';
import { useUIStore } from '../../store/uiStore';
import { PLATE_REGEX, normalizePlate } from '../../utils/vehicle';

function AnimatedPressable({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress: () => void;
  style?: any;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.96, { duration: 100 });
  };
  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 150 });
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={style}>
      <Animated.View style={[{ width: '100%', alignItems: 'center', justifyContent: 'center' }, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

function AnimatedCard({ children, index, style }: { children: React.ReactNode; index: number; style?: any }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(15);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    opacity.value = withDelay(index * 60, withTiming(1, { duration: 400 }));
    translateY.value = withDelay(index * 60, withTiming(0, { duration: 400 }));
  }, [index]);

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

const MAX_PLATES = 3;

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
  const [vehicleType, setVehicleType] = useState<PlateVehicleType>('motorcycle');
  const [plateError, setPlateError] = useState<string | null>(null);
  const [plateSuccess, setPlateSuccess] = useState<string | null>(null);
  const [loadingPlate, setLoadingPlate] = useState<string | null>(null);
  const [plateToRemove, setPlateToRemove] = useState<LicensePlate | null>(null);
  const [plateQrToShow, setPlateQrToShow] = useState<LicensePlate | null>(null);

  const plates = session?.licensePlates ?? [];

  const setTabBarHidden = useUIStore((state) => state.setTabBarHidden);

  useEffect(() => {
    const isModalActive = plateToRemove !== null || plateQrToShow !== null;
    setTabBarHidden(isModalActive);
    return () => setTabBarHidden(false);
  }, [plateToRemove, plateQrToShow, setTabBarHidden]);

  // Header animation shared values
  const headerY = useSharedValue(-15);
  const headerOpacity = useSharedValue(0);

  useEffect(() => {
    headerY.value = withTiming(0, { duration: 400 });
    headerOpacity.value = withTiming(1, { duration: 400 });
  }, []);

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerY.value }],
  }));

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
      setPlateError('Invalid format. Examples: 51F-970.22 · 51F1-2345 · 29AB-226.58');
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

  const executeRemovePlate = async (plate: LicensePlate) => {
    if (!plate._id) return;
    setPlateError(null);
    setPlateSuccess(null);
    try {
      setLoadingPlate(plate._id);
      const updated = await removePlate(token, plate._id);
      updateLocal({ licensePlates: updated });
      setPlateSuccess(`Removed "${plate.plateNumber}" successfully!`);
      setTimeout(() => setPlateSuccess(null), 2500);
    } catch (err) {
      setPlateError(err instanceof Error ? err.message : 'Failed to remove plate');
    } finally {
      setLoadingPlate(null);
    }
  };

  const handleRemovePlate = (plate: LicensePlate) => {
    if (!plate._id) return;
    setPlateToRemove(plate);
  };

  const closeRemoveModal = () => {
    if (plateToRemove && loadingPlate === plateToRemove._id) return;
    setPlateToRemove(null);
  };

  const handleConfirmRemove = async () => {
    if (!plateToRemove) return;
    await executeRemovePlate(plateToRemove);
    setPlateToRemove(null);
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
          <Animated.View style={[styles.header, headerStyle]}>
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
          </Animated.View>

          {/* Tabs */}
          <View style={styles.tabRow}>
            {(['info', 'plates', 'password'] as Tab[]).map((t) => (
              <AnimatedPressable
                key={t}
                style={[styles.tabBtn, tab === t && styles.tabBtnActive, { flex: 1 }]}
                onPress={() => setTab(t)}
              >
                <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
                  {t === 'info' ? 'Info' : t === 'plates' ? 'Plates' : 'Password'}
                </Text>
              </AnimatedPressable>
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
                    ].map((item, idx) => (
                      <AnimatedCard key={item.label} index={idx}>
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>{item.label}</Text>
                          <Text style={styles.infoValue}>{item.value}</Text>
                        </View>
                      </AnimatedCard>
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
                        uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${session.userId}`,
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
                  <Text style={styles.emptyText}>
                    No license plates linked yet.
                  </Text>
                ) : (
                  plates.map((plate, idx) => (
                    <AnimatedCard key={plate.plateNumber} index={idx}>
                      <View
                        style={[
                          styles.plateItem,
                          plate.isDefault && styles.plateItemDefault,
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.plateNumber,
                              plate.isDefault && { color: Colors.amber },
                            ]}
                          >
                            {plate.plateNumber}
                          </Text>

                          <Text style={styles.plateType}>
                            {PLATE_TYPE_LABELS[plate.vehicleType] ?? plate.vehicleType}
                            {plate.isDefault ? ' · Default' : ''}
                          </Text>
                        </View>

                        <View style={styles.plateBtns}>
                          {plate.qrCode && (
                            <TouchableOpacity
                              style={styles.plateAction}
                              onPress={() => setPlateQrToShow(plate)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Text style={styles.plateActionText}>⊞ QR</Text>
                            </TouchableOpacity>
                          )}

                          {!plate.isDefault && plate._id && (
                            <TouchableOpacity
                              style={styles.plateAction}
                              onPress={() => handleSetDefault(plate)}
                              disabled={loadingPlate === plate._id}
                            >
                              <Text style={styles.plateActionText}>
                                ★ Set default
                              </Text>
                            </TouchableOpacity>
                          )}

                          {plate._id && (
                            <TouchableOpacity
                              style={[styles.plateAction, styles.plateActionDelete]}
                              onPress={() => handleRemovePlate(plate)}
                              disabled={loadingPlate === plate._id}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Text style={styles.plateActionDeleteText}>Remove</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </AnimatedCard>
                  ))
                )}
              </View>

              {/* Add plate form */}
              {plates.length < MAX_PLATES && (
                <View style={styles.addPlateForm}>
                  <Text style={styles.addPlateTitle}>Add Plate</Text>

                  {/* Vehicle type — chọn loại xe (gồm "Khác") */}
                  <View style={[styles.typeToggle, { flexWrap: 'wrap' }]}>
                    {VEHICLE_PRESETS.map((p) => (
                      <TouchableOpacity
                        key={p.value}
                        style={[styles.typeBtn, vehicleType === p.value && styles.typeBtnActive]}
                        onPress={() => setVehicleType(p.value as PlateVehicleType)}
                      >
                        <Text style={[styles.typeBtnText, vehicleType === p.value && styles.typeBtnTextActive]}>
                          {p.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
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

      <Modal
        visible={plateToRemove !== null}
        transparent
        animationType="fade"
        onRequestClose={closeRemoveModal}
      >
        <Pressable style={styles.confirmOverlay} onPress={closeRemoveModal}>
          <View style={styles.confirmDialog}>
            <Text style={styles.confirmTitle}>Remove Plate</Text>
            <Text style={styles.confirmMessage}>
              {plateToRemove
                ? `Remove license plate "${plateToRemove.plateNumber}"?`
                : ''}
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnCancel]}
                onPress={closeRemoveModal}
                disabled={Boolean(plateToRemove?._id && loadingPlate === plateToRemove._id)}
              >
                <Text style={styles.confirmBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnConfirm]}
                onPress={() => { void handleConfirmRemove(); }}
                disabled={Boolean(plateToRemove?._id && loadingPlate === plateToRemove._id)}
              >
                <Text style={styles.confirmBtnConfirmText}>
                  {plateToRemove?._id && loadingPlate === plateToRemove._id ? 'Removing…' : 'Confirm'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Per-plate QR code modal — staff scans this to identify the vehicle */}
      <Modal
        visible={plateQrToShow !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPlateQrToShow(null)}
      >
        <Pressable style={styles.confirmOverlay} onPress={() => setPlateQrToShow(null)}>
          <View style={styles.qrDialog}>
            <Text style={styles.confirmTitle}>Plate QR Code</Text>
            <Text style={styles.qrPlateText}>{plateQrToShow?.plateNumber}</Text>
            {plateQrToShow?.qrCode ? (
              <View style={styles.plateQrImageWrap}>
                <Image
                  source={{
                    uri: `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(plateQrToShow.qrCode)}`,
                  }}
                  style={styles.plateQrImage}
                />
              </View>
            ) : null}
            <Text style={styles.qrHintText}>
              Show this code to staff at the gate to identify your vehicle.
            </Text>
            <TouchableOpacity
              style={[styles.confirmBtn, styles.confirmBtnCancel, { alignSelf: 'stretch' }]}
              onPress={() => setPlateQrToShow(null)}
            >
              <Text style={styles.confirmBtnCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
