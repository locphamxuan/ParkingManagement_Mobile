import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { listMyIncidents, reportIncident, getViolationTypes, type MobileIncident, type ViolationTypeOption } from '../services/incidents';
import { listBuildings, type BuildingOption } from '../services/buildingLookup';
import { listParkingHistory } from '../services/history';
import { listSubscriptions } from '../services/longTerm';
import { ApiError } from '../services/api';
import { Colors, Spacing } from '../constants/theme';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { styles } from '../styles/screens/incidents';
import { PLATE_REGEX, normalizePlate } from '../utils/vehicle';

// Sự cố "tự thân" — cố định, không liên quan tới phạt 1 xe/biển số khác. Loại vi
// phạm (report a violation) giờ lấy động từ bảng giá manager cấu hình cho building.
const GENERAL_INCIDENT_TYPES = [
  { value: 'vehicle_damaged', label: 'Vehicle Damaged / Scratched' },
  { value: 'facility_issue', label: 'Facility Issue (broken lights/floors)' },
  { value: 'wrong_scan', label: 'Incorrect License Plate Scan' },
  { value: 'payment_dispute', label: 'Payment / Fee Dispute' },
  { value: 'security', label: 'Security (suspicious activity)' },
  { value: 'other', label: 'Other General Incident' },
];

export default function IncidentsScreen() {
  const { session } = useAuthStore();
  const token = session?.token ?? '';

  const [activeTab, setActiveTab] = useState<'report' | 'list'>('report');
  const [incidents, setIncidents] = useState<MobileIncident[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [selectedType, setSelectedType] = useState('other');
  const [violatorPlate, setViolatorPlate] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Building picker fallback — chỉ hiện khi BE không tự suy ra được building
  // (user không có active session/subscription nào) → chặn 400 BUILDING_REQUIRED.
  const [needsBuilding, setNeedsBuilding] = useState(false);
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [loadingBuildings, setLoadingBuildings] = useState(false);

  // Loại vi phạm manager cấu hình cho building của phiên đang đỗ (nếu có).
  const [violationTypes, setViolationTypes] = useState<ViolationTypeOption[]>([]);
  const isViolationReport = violationTypes.some((v) => v.code === selectedType) || selectedType === 'other';

  // Building của phiên đang đỗ (nếu có) → nếu không, building của gói dài hạn đang
  // active (subscriber không nhất thiết đang có xe trong bãi) — mirror đúng thứ tự
  // suy luận building mà BE dùng ở createIncident, để user luôn thấy ĐỦ số loại vi
  // phạm manager đang cấu hình cho building của họ, không chỉ khi đang có xe đỗ.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      let buildingId: string | undefined;
      try {
        const sessions = await listParkingHistory(token);
        buildingId = sessions.find((s) => s.status === 'active')?.building?._id;
      } catch {
        // ignore — fall through to subscription lookup below
      }
      if (!buildingId) {
        try {
          const subs = await listSubscriptions(token);
          buildingId = subs.find((s) => s.status === 'active')?.building?._id;
        } catch {
          // ignore — no session/subscription found, leave violationTypes empty
        }
      }
      try {
        const types = buildingId ? await getViolationTypes(token, buildingId) : [];
        if (!cancelled) setViolationTypes(types);
      } catch {
        if (!cancelled) setViolationTypes([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Building được chọn tay ở bước fallback (needsBuilding) — cũng nạp lại bảng giá
  // vi phạm theo đúng building đó thay vì building phiên đỗ (nếu có).
  useEffect(() => {
    if (!token || !selectedBuildingId) return;
    getViolationTypes(token, selectedBuildingId)
      .then(setViolationTypes)
      .catch(() => setViolationTypes([]));
  }, [token, selectedBuildingId]);

  const loadIncidents = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listMyIncidents(token);
      setIncidents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === 'list') {
      loadIncidents();
    }
  }, [activeTab, loadIncidents]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadIncidents();
    setRefreshing(false);
  };

  const handleReport = async () => {
    if (!token) return;
    if (!note.trim()) {
      setError('Please provide a detailed description of the incident.');
      return;
    }

    let normalizedViolatorPlate: string | undefined = undefined;
    if (isViolationReport) {
      const trimmed = violatorPlate.trim();
      if (trimmed) {
        const norm = normalizePlate(trimmed);
        if (!PLATE_REGEX.test(norm)) {
          setError('Invalid license plate format (e.g. 59G2-038.80).');
          return;
        }
        normalizedViolatorPlate = norm;
      }
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await reportIncident(token, {
        type: selectedType,
        violatorPlate: normalizedViolatorPlate,
        note: note.trim(),
        buildingId: needsBuilding ? (selectedBuildingId || undefined) : undefined,
      });
      setSuccessMsg('Thank you. Your incident report has been submitted to the building security crew.');
      setNote('');
      setViolatorPlate('');
      setNeedsBuilding(false);
      setSelectedBuildingId('');
      // Switch to list after brief delay
      setTimeout(() => {
        setSuccessMsg(null);
        setActiveTab('list');
      }, 2500);
    } catch (err) {
      if (err instanceof ApiError && err.errorCode === 'BUILDING_REQUIRED') {
        setError('You have no active parking session. Please select which building this incident happened in.');
        setNeedsBuilding(true);
        if (buildings.length === 0) {
          setLoadingBuildings(true);
          try {
            const list = await listBuildings(token);
            setBuildings(list);
          } catch {
            // ignore — user can retry via pull/refresh of the picker
          } finally {
            setLoadingBuildings(false);
          }
        }
      } else {
        setError(err instanceof Error ? err.message : 'Submission failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusVariant = (status: string): 'success' | 'error' | 'warning' | 'info' | 'default' | 'orange' | 'purple' => {
    switch (status) {
      case 'open':
        return 'warning';
      case 'investigating':
        return 'info';
      case 'escalated':
        return 'orange';
      case 'penalty_pending':
        return 'purple';
      case 'resolved':
        return 'success';
      case 'closed':
      default:
        return 'default';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report Incident</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'report' && styles.activeTab]}
          onPress={() => setActiveTab('report')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'report' && styles.activeTabText]}>
            Report Issue
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'list' && styles.activeTab]}
          onPress={() => setActiveTab('list')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'list' && styles.activeTabText]}>
            My Tickets
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {activeTab === 'report' ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {!!successMsg && (
              <View style={[styles.msgCard, styles.successCard]}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                <Text style={styles.successText}>{successMsg}</Text>
              </View>
            )}

            {!!error && (
              <View style={[styles.msgCard, styles.errorCard]}>
                <Ionicons name="alert-circle" size={16} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.inputLabel}>Incident Type</Text>
              <View style={styles.pickerContainer}>
                {[...violationTypes.map((v) => ({ value: v.code, label: v.label })), ...GENERAL_INCIDENT_TYPES].map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[
                      styles.typeOption,
                      selectedType === t.value && styles.typeOptionActive,
                    ]}
                    onPress={() => setSelectedType(t.value)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={selectedType === t.value ? 'radio-button-on' : 'radio-button-off'}
                      size={16}
                      color={selectedType === t.value ? Colors.primary : Colors.textDim}
                    />
                    <Text
                      style={[
                        styles.typeOptionText,
                        selectedType === t.value && styles.typeOptionTextActive,
                      ]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {isViolationReport && (
                <>
                  <Text style={styles.inputLabel}>Offending Vehicle Plate (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="E.g. 59G2-038.80"
                    placeholderTextColor={Colors.textDim}
                    value={violatorPlate}
                    onChangeText={(v) => setViolatorPlate(v.toUpperCase())}
                    autoCapitalize="characters"
                    maxLength={20}
                  />
                </>
              )}

              <Text style={styles.inputLabel}>Detailed Description</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Please describe what happened in detail..."
                placeholderTextColor={Colors.textDim}
                multiline
                numberOfLines={4}
                value={note}
                onChangeText={setNote}
                maxLength={500}
              />

              {needsBuilding && (
                <>
                  <Text style={styles.inputLabel}>Building</Text>
                  {loadingBuildings ? (
                    <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: Spacing.sm }} />
                  ) : (
                    <View style={styles.pickerContainer}>
                      {buildings.map((b) => (
                        <TouchableOpacity
                          key={b._id}
                          style={[styles.typeOption, selectedBuildingId === b._id && styles.typeOptionActive]}
                          onPress={() => setSelectedBuildingId(b._id)}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name={selectedBuildingId === b._id ? 'radio-button-on' : 'radio-button-off'}
                            size={16}
                            color={selectedBuildingId === b._id ? Colors.primary : Colors.textDim}
                          />
                          <Text style={[styles.typeOptionText, selectedBuildingId === b._id && styles.typeOptionTextActive]}>
                            {b.name} ({b.code})
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              )}

              <Button
                label={submitting ? 'Submitting...' : 'Submit Report'}
                onPress={handleReport}
                loading={submitting}
                disabled={needsBuilding && !selectedBuildingId}
                style={{ marginTop: Spacing.md }}
              />
            </View>
          </ScrollView>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
            }
          >
            {loading && !refreshing ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
            ) : incidents.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="document-text-outline" size={48} color={Colors.textDim} />
                <Text style={styles.emptyText}>You haven't reported any incidents yet.</Text>
              </View>
            ) : (
              incidents.map((inc) => (
                <View key={inc._id} style={styles.ticketCard}>
                  <View style={styles.ticketHeader}>
                    <Text style={styles.ticketCode}>{inc.code}</Text>
                    <Badge
                      label={inc.status.toUpperCase()}
                      variant={getStatusVariant(inc.status)}
                    />
                  </View>

                  <Text style={styles.ticketType}>
                    {GENERAL_INCIDENT_TYPES.find((t) => t.value === inc.type)?.label
                      ?? violationTypes.find((v) => v.code === inc.type)?.label
                      ?? inc.type}
                  </Text>

                  {!!inc.target && (
                    <Text style={styles.ticketTarget}>
                      Target: <Text style={{ fontWeight: 'bold' }}>{inc.target}</Text>
                    </Text>
                  )}

                  <Text style={styles.ticketNote}>{inc.note}</Text>

                  {inc.status === 'escalated' && (
                    <Text style={styles.escalatedNote}>
                      The reported plate has no registered account in this building — a manager is handling it directly.
                    </Text>
                  )}

                  <Text style={styles.ticketTime}>
                    Reported At: {new Date(inc.createdAt).toLocaleString('vi-VN')}
                  </Text>

                  {!!inc.resolutionNote && (
                    <View style={styles.resolutionBox}>
                      <Text style={styles.resolutionTitle}>Security Response:</Text>
                      <Text style={styles.resolutionText}>{inc.resolutionNote}</Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
