import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../store/authStore';
import {
  getManagerBuildings,
  getFeedbacks,
  respondToFeedback,
  type ManagerBuilding,
  type FeedbackItem,
  type FeedbackStatus,
} from '../../../services/manager';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Colors, FontSize, Radius, Spacing } from '../../../constants/theme';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatDateFull(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} at ${hour}:${min}`;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${hour}:${min}`;
}

// ─── Status Config ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<FeedbackStatus, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; border: string }> = {
  open: {
    label: 'Open',
    icon: 'alert-circle-outline',
    color: Colors.warning,
    bg: Colors.warningBg,
    border: Colors.warningBorder,
  },
  in_progress: {
    label: 'In Progress',
    icon: 'hammer-outline',
    color: Colors.blue,
    bg: Colors.blueBg,
    border: Colors.borderAlt,
  },
  resolved: {
    label: 'Resolved',
    icon: 'checkmark-circle-outline',
    color: Colors.success,
    bg: Colors.successBg,
    border: Colors.successBorder,
  },
  closed: {
    label: 'Closed',
    icon: 'lock-closed-outline',
    color: Colors.textDim,
    bg: Colors.cardAlt,
    border: Colors.border,
  },
};

// ─── Rating Stars ────────────────────────────────────────────────────────────

function RatingStars({ rating }: { rating: number }) {
  const stars: React.ReactNode[] = [];
  for (let i = 1; i <= 5; i++) {
    const filled = i <= rating;
    stars.push(
      <Ionicons
        key={i}
        name={filled ? 'star' : 'star-outline'}
        size={15}
        color={filled ? Colors.amber : Colors.textDim}
        style={{ marginRight: 2 }}
      />,
    );
  }
  return (
    <View style={styles.ratingRow}>
      <Text style={[styles.ratingNumber, { color: Colors.amber }]}>
        {rating}
      </Text>
      <View style={styles.starsRow}>{stars}</View>
    </View>
  );
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FeedbackStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <View style={[styles.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <Ionicons name={cfg.icon} size={12} color={cfg.color} />
      <Text style={[styles.statusBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

// ─── Feedback Card ────────────────────────────────────────────────────────────

interface FeedbackCardProps {
  item: FeedbackItem;
  buildingId: string;
  token: string;
  onResponded: (feedbackId: string, updated: FeedbackItem) => void;
}

function FeedbackCard({ item, buildingId, token, onResponded }: FeedbackCardProps) {
  const [responseText, setResponseText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const showResponseForm =
    !item.response && (item.status === 'open' || item.status === 'in_progress');

  const handleSubmitResponse = useCallback(async () => {
    const trimmed = responseText.trim();
    if (!trimmed) return;

    setSubmitError(null);
    setSubmitting(true);

    try {
      const res = await respondToFeedback(buildingId, item._id, token, {
        response: trimmed,
        status: 'resolved',
      });
      if (res?.data) {
        onResponded(item._id, res.data);
        setResponseText('');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit response';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [responseText, buildingId, item._id, token, onResponded]);

  return (
    <Card style={styles.feedbackCard} padding={Spacing.lg}>
      {/* ── Header: User + Status ──────────────────────────────────────── */}
      <View style={styles.cardHeader}>
        <View style={styles.userAvatar}>
          <Ionicons name="person" size={18} color={Colors.text} />
        </View>
        <View style={styles.cardHeaderInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.user.fullName}
          </Text>
          <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
        </View>
        <StatusBadge status={item.status} />
      </View>

      {/* ── Rating ─────────────────────────────────────────────────────── */}
      <RatingStars rating={item.rating} />

      {/* ── Subject ────────────────────────────────────────────────────── */}
      <Text style={styles.subject}>{item.subject}</Text>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <Text style={styles.content}>{item.content}</Text>

      {/* ── Existing Response (shaded sub-box) ──────────────────────────── */}
      {item.response && (
        <View style={styles.existingResponseBox}>
          <View style={styles.existingResponseHeader}>
            <Ionicons name="chatbox-ellipses-outline" size={14} color={Colors.primary} />
            <Text style={styles.existingResponseLabel}>Manager Response</Text>
          </View>
          <Text style={styles.existingResponseText}>{item.response}</Text>
          {item.updatedAt && (
            <Text style={styles.existingResponseMeta}>
              Responded on {formatDateFull(item.updatedAt)}
            </Text>
          )}
        </View>
      )}

      {/* ── Inline Response Form ───────────────────────────────────────── */}
      {showResponseForm && (
        <View style={styles.responseForm}>
          <Input
            placeholder="Type your official response here..."
            value={responseText}
            onChangeText={setResponseText}
            multiline
            numberOfLines={4}
            inputStyle={styles.responseInput}
          />
          {submitError && (
            <View style={styles.submitErrorRow}>
              <Ionicons name="alert-circle-outline" size={14} color={Colors.error} />
              <Text style={styles.submitErrorText}>{submitError}</Text>
            </View>
          )}
          <Button
            label="Submit Response"
            onPress={handleSubmitResponse}
            loading={submitting}
            disabled={!responseText.trim()}
            fullWidth
            size="md"
            variant="primary"
          />
        </View>
      )}

      {/* ── Footer timestamp ───────────────────────────────────────────── */}
      <View style={styles.cardFooter}>
        <Ionicons name="time-outline" size={12} color={Colors.textDim} />
        <Text style={styles.cardFooterText}>
          Submitted at {formatTime(item.createdAt)}
        </Text>
      </View>
    </Card>
  );
}

// ─── Summary Header Stats ────────────────────────────────────────────────────

interface SummaryStatsProps {
  items: FeedbackItem[];
}

function SummaryStats({ items }: SummaryStatsProps) {
  const openCount = items.filter((i) => i.status === 'open').length;
  const inProgressCount = items.filter((i) => i.status === 'in_progress').length;
  const resolvedCount = items.filter(
    (i) => i.status === 'resolved' || i.status === 'closed',
  ).length;
  const avgRating =
    items.length > 0
      ? (items.reduce((sum, i) => sum + i.rating, 0) / items.length).toFixed(1)
      : '—';

  return (
    <Card style={styles.summaryCard} padding={Spacing.md}>
      <View style={styles.summaryGrid}>
        <View style={styles.summaryItem}>
          <Ionicons name="alert-circle-outline" size={14} color={Colors.warning} />
          <Text style={styles.summaryNumber}>{openCount}</Text>
          <Text style={styles.summaryLabel}>Open</Text>
        </View>
        <View style={styles.summaryItem}>
          <Ionicons name="hammer-outline" size={14} color={Colors.blue} />
          <Text style={styles.summaryNumber}>{inProgressCount}</Text>
          <Text style={styles.summaryLabel}>In Prog.</Text>
        </View>
        <View style={styles.summaryItem}>
          <Ionicons name="checkmark-circle-outline" size={14} color={Colors.success} />
          <Text style={styles.summaryNumber}>{resolvedCount}</Text>
          <Text style={styles.summaryLabel}>Resolved</Text>
        </View>
        <View style={styles.summaryItem}>
          <Ionicons name="star" size={14} color={Colors.amber} />
          <Text style={styles.summaryNumber}>{avgRating}</Text>
          <Text style={styles.summaryLabel}>Avg Rating</Text>
        </View>
      </View>
    </Card>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function FeedbackScreen() {
  const router = useRouter();
  const { session } = useAuthStore();
  const token = session?.token ?? '';
  const scrollRef = useRef<ScrollView>(null);

  // State
  const [building, setBuilding] = useState<ManagerBuilding | null>(null);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Safe array unwrapper ──────────────────────────────────────────────────
  // Backend may return either { data: [...] } or { data: { items: [...] } }.
  const toArray = useCallback((val: unknown): any[] => {
    if (Array.isArray(val)) return val;
    if (val && typeof val === 'object' && 'items' in (val as object) && Array.isArray((val as Record<string, unknown>).items)) {
      return (val as Record<string, unknown>).items as any[];
    }
    return [];
  }, []);

  // ── Fetch Feedbacks ──────────────────────────────────────────────────────

  const fetchFeedbacks = useCallback(async () => {
    if (!token) return;
    setError(null);

    try {
      const buildingsRes = await getManagerBuildings(token);
      const buildings = Array.isArray(buildingsRes?.data) ? buildingsRes.data : [];

      if (buildings.length === 0) {
        setBuilding(null);
        setFeedbacks([]);
        return;
      }

      const bld = buildings[0];
      setBuilding(bld);

      const fbRes = await getFeedbacks(bld._id, token);
      setFeedbacks(toArray(fbRes?.data));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load feedbacks';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, toArray]);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  // ── Handle Response Success ──────────────────────────────────────────────

  const handleResponded = useCallback(
    (feedbackId: string, updated: FeedbackItem) => {
      setFeedbacks((prev) =>
        prev.map((fb) => (fb._id === feedbackId ? updated : fb)),
      );
    },
    [],
  );

  // ── Sort: Open first, then in_progress, then by newest ──────────────────

  const sortedFeedbacks = React.useMemo(() => {
    const safe = Array.isArray(feedbacks) ? feedbacks : [];
    const order: Record<FeedbackStatus, number> = {
      open: 0,
      in_progress: 1,
      resolved: 2,
      closed: 3,
    };

    return [...safe].sort((a, b) => {
      const diff = order[a.status] - order[b.status];
      if (diff !== 0) return diff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [feedbacks]);

  // ── Render: Loading ───────────────────────────────────────────────────────

  if (loading && !building) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading customer feedbacks…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        >
          {/* Glow decoration */}
          <View style={styles.glow} pointerEvents="none" />

          {/* ── Header ──────────────────────────────────────────────────── */}
          <View style={styles.headerSection}>
            <Text style={styles.pageTitle}>Customer Feedbacks</Text>
            <Text style={styles.pageSubtitle}>
              Review ratings and respond to building support tickets
            </Text>
          </View>

          {/* ── Error Banner ────────────────────────────────────────────── */}
          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={18} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* ── No Building ─────────────────────────────────────────────── */}
          {!building && !loading && !error && (
            <View style={styles.emptyBox}>
              <Ionicons name="business-outline" size={48} color={Colors.textDim} />
              <Text style={styles.emptyTitle}>No Building Assigned</Text>
              <Text style={styles.emptyText}>
                You don't have any building assigned to your account yet.
              </Text>
            </View>
          )}

          {building && (
            <>
              {/* ── Summary Stats ──────────────────────────────────────── */}
              {feedbacks.length > 0 && <SummaryStats items={feedbacks} />}

              {/* ── Section Header ────────────────────────────────────── */}
              {feedbacks.length > 0 && (
                <View style={styles.sectionHeader}>
                  <Ionicons name="chatbubbles-outline" size={18} color={Colors.primary} />
                  <Text style={styles.sectionTitle}>All Tickets & Ratings</Text>
                  <Text style={styles.sectionCount}>
                    {feedbacks.length} feedback{feedbacks.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              )}

              {/* ── Feedbacks List ─────────────────────────────────────── */}
              {!loading && sortedFeedbacks.length === 0 ? (
                <View style={styles.emptyFeedbacksBox}>
                  <Ionicons
                    name="chatbubbles-outline"
                    size={48}
                    color={Colors.textDim}
                  />
                  <Text style={styles.emptyFeedbacksTitle}>No Feedbacks Yet</Text>
                  <Text style={styles.emptyFeedbacksText}>
                    Customer feedbacks and support tickets will appear here once
                    submitted by building tenants or visitors.
                  </Text>
                </View>
              ) : (
                <View style={styles.feedbacksList}>
                  {sortedFeedbacks.map((fb) => (
                    <FeedbackCard
                      key={fb._id}
                      item={fb}
                      buildingId={building._id}
                      token={token}
                      onResponded={handleResponded}
                    />
                  ))}
                </View>
              )}

              {/* Bottom spacer */}
              <View style={{ height: 24 }} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: 32,
    gap: Spacing.lg,
  },
  glow: {
    position: 'absolute',
    top: -140,
    left: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(249,115,22,0.05)',
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  headerSection: {
    gap: Spacing.xs,
  },
  pageTitle: {
    fontSize: FontSize['2xl'],
    fontWeight: '900',
    color: Colors.text,
  },
  pageSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: '500',
    lineHeight: 20,
  },

  // ── Error ──────────────────────────────────────────────────────────────────
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    padding: Spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.error,
    fontWeight: '600',
  },

  // ── Empty state (no building) ──────────────────────────────────────────────
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['3xl'],
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '900',
    color: Colors.text,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.xl,
  },

  // ── Summary Card ───────────────────────────────────────────────────────────
  summaryCard: {
    borderColor: Colors.border,
  },
  summaryGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
    gap: 3,
    flex: 1,
  },
  summaryNumber: {
    fontSize: FontSize.lg,
    fontWeight: '900',
    color: Colors.text,
  },
  summaryLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textMuted,
  },

  // ── Section Header ─────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  sectionTitle: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: Colors.text,
  },
  sectionCount: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textMuted,
  },

  // ── Feedbacks List ─────────────────────────────────────────────────────────
  feedbacksList: {
    gap: Spacing.md,
  },

  // ── Empty Feedbacks ────────────────────────────────────────────────────────
  emptyFeedbacksBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['3xl'],
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyFeedbacksTitle: {
    fontSize: FontSize.base,
    fontWeight: '900',
    color: Colors.text,
  },
  emptyFeedbacksText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.xl,
  },

  // ── Feedback Card ─────────────────────────────────────────────────────────
  feedbackCard: {
    gap: Spacing.md,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardAlt,
  },
  cardHeaderInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.text,
  },
  cardDate: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textMuted,
  },

  // ── Status Badge ───────────────────────────────────────────────────────────
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Rating ─────────────────────────────────────────────────────────────────
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  ratingNumber: {
    fontSize: FontSize.base,
    fontWeight: '900',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // ── Subject ───────────────────────────────────────────────────────────────
  subject: {
    fontSize: FontSize.base,
    fontWeight: '800',
    color: Colors.text,
    lineHeight: 22,
  },

  // ── Content ────────────────────────────────────────────────────────────────
  content: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.textMuted,
    lineHeight: 20,
  },

  // ── Existing Response (shaded sub-box) ─────────────────────────────────────
  existingResponseBox: {
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  existingResponseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  existingResponseLabel: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  existingResponseText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.text,
    lineHeight: 20,
  },
  existingResponseMeta: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textDim,
  },

  // ── Inline Response Form ───────────────────────────────────────────────────
  responseForm: {
    gap: Spacing.sm,
  },
  responseInput: {
    minHeight: 100,
  },
  submitErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  submitErrorText: {
    flex: 1,
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.error,
  },

  // ── Card Footer ────────────────────────────────────────────────────────────
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardFooterText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textDim,
  },
});