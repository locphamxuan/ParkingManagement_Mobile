import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { listMyIncidents, reportIncident, type MobileIncident } from '../services/incidents';
import { Colors, FontSize, Radius, Spacing } from '../constants/theme';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

const INCIDENT_TYPES = [
  { value: 'slot_occupied', label: 'Slot Occupied by someone else' },
  { value: 'slot_blocked', label: 'Slot Blocked / Obstructed' },
  { value: 'vehicle_damaged', label: 'Vehicle Damaged / Scratched' },
  { value: 'facility_issue', label: 'Facility Issue (broken lights/floors)' },
  { value: 'wrong_scan', label: 'Incorrect License Plate Scan' },
  { value: 'payment_dispute', label: 'Payment / Fee Dispute' },
  { value: 'lost_ticket', label: 'Lost Parking Ticket / QR code' },
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
  const [selectedType, setSelectedType] = useState('slot_occupied');
  const [target, setTarget] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await reportIncident(token, {
        type: selectedType,
        target: target.trim() || undefined,
        note: note.trim(),
      });
      setSuccessMsg('Thank you. Your incident report has been submitted to the building security crew.');
      setNote('');
      setTarget('');
      // Switch to list after brief delay
      setTimeout(() => {
        setSuccessMsg(null);
        setActiveTab('list');
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusVariant = (status: string): 'success' | 'error' | 'warning' | 'info' | 'default' | 'orange' | 'purple' => {
    switch (status) {
      case 'open':
        return 'warning';
      case 'investigating':
      case 'escalated':
        return 'info';
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
            {successMsg && (
              <View style={[styles.msgCard, styles.successCard]}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                <Text style={styles.successText}>{successMsg}</Text>
              </View>
            )}

            {error && (
              <View style={[styles.msgCard, styles.errorCard]}>
                <Ionicons name="alert-circle" size={16} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.inputLabel}>Incident Type</Text>
              <View style={styles.pickerContainer}>
                {INCIDENT_TYPES.map((t) => (
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

              <Text style={styles.inputLabel}>Related Plate / Slot Code (Optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="E.g. 59G2-038.80 or Slot A-05"
                placeholderTextColor={Colors.textDim}
                value={target}
                onChangeText={setTarget}
                maxLength={40}
              />

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

              <Button
                label={submitting ? 'Submitting...' : 'Submit Report'}
                onPress={handleReport}
                loading={submitting}
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
                    {INCIDENT_TYPES.find((t) => t.value === inc.type)?.label ?? inc.type}
                  </Text>

                  {inc.target && (
                    <Text style={styles.ticketTarget}>
                      Target: <Text style={{ fontWeight: 'bold' }}>{inc.target}</Text>
                    </Text>
                  )}

                  <Text style={styles.ticketNote}>{inc.note}</Text>

                  <Text style={styles.ticketTime}>
                    Reported At: {new Date(inc.createdAt).toLocaleString('vi-VN')}
                  </Text>

                  {inc.resolutionNote && (
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: '900',
    color: Colors.text,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    padding: Spacing.xs,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Radius.sm,
  },
  activeTab: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textDim,
  },
  activeTabText: {
    color: '#ffffff',
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  msgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  successCard: {
    backgroundColor: Colors.successBg,
    borderColor: Colors.successBorder,
  },
  successText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.success,
  },
  errorCard: {
    backgroundColor: Colors.errorBg,
    borderColor: Colors.errorBorder,
  },
  errorText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.error,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  inputLabel: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.cardAlt,
    padding: Spacing.xs,
    gap: 4,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
  },
  typeOptionActive: {
    backgroundColor: 'rgba(14,165,233,0.06)',
  },
  typeOptionText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  typeOptionTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: Colors.input,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  textArea: {
    height: 100,
    paddingTop: Spacing.md,
    textAlignVertical: 'top',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textDim,
    fontWeight: '600',
  },
  ticketCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: 6,
  },
  ticketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ticketCode: {
    fontSize: FontSize.sm,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'mono',
    color: Colors.text,
  },
  ticketType: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 4,
  },
  ticketTarget: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  ticketNote: {
    fontSize: FontSize.sm,
    color: Colors.textDim,
    lineHeight: 18,
    marginTop: 2,
  },
  ticketTime: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    fontWeight: '500',
    marginTop: 4,
  },
  resolutionBox: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: 'rgba(16,185,129,0.06)',
    borderColor: 'rgba(16,185,129,0.15)',
    borderWidth: 1,
    borderRadius: Radius.md,
    gap: 4,
  },
  resolutionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: '#047857',
  },
  resolutionText: {
    fontSize: FontSize.sm,
    color: '#065f46',
    fontWeight: '600',
  },
});
