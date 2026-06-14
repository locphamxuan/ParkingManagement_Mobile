import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Bell, BellRing, Inbox, MessageCircleReply, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import { listMyFeedbackInbox, type FeedbackInboxItem } from '../../services/feedbackInbox';

interface NotificationBellStreamProps {
  token: string;
  onOpenItem?: (item: FeedbackInboxItem) => void;
}

function formatDateTime(value?: string): string {
  if (!value) return 'Vừa cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Vừa cập nhật';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

function resolveBuildingName(item: FeedbackInboxItem): string {
  return item.building?.name || item.building?.code || 'PBMS Parking';
}

function resolvePlate(item: FeedbackInboxItem): string {
  return item.parkingSession?.plateNumber || 'Chưa có biển số';
}

function hasManagerReply(item: FeedbackInboxItem): boolean {
  return Boolean(item.staffReply && item.staffReply.trim().length > 0);
}

// Read state is persisted client-side only (no BE involvement). The key is
// derived from the auth token so different users on the same device don't see
// each other's read state.
const READ_IDS_KEY_PREFIX = 'pbms_feedback_read_ids:';
function readIdsKeyFor(token: string): string {
  const suffix = token ? token.slice(-16) : 'anon';
  return READ_IDS_KEY_PREFIX + suffix;
}

export default function NotificationBellStream({
  token,
  onOpenItem,
}: NotificationBellStreamProps) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<FeedbackInboxItem[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Load persisted read state whenever the active token changes (e.g. after
  // login / logout). On native this hits SecureStore-backed AsyncStorage; on
  // web it falls back to localStorage transparently.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(readIdsKeyFor(token));
        if (cancelled || !mounted.current) return;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setReadIds(parsed.filter((id): id is string => typeof id === 'string'));
            return;
          }
        }
        setReadIds([]);
      } catch {
        if (!cancelled && mounted.current) setReadIds([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Persist read state whenever it changes so the unread badge survives reloads.
  useEffect(() => {
    void AsyncStorage.setItem(readIdsKeyFor(token), JSON.stringify(readIds)).catch(() => undefined);
  }, [readIds, token]);

  const loadFeedbackInbox = async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const data = await listMyFeedbackInbox(token);
      if (!mounted.current) return;
      setItems(data.filter(hasManagerReply));
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : 'Không thể tải hộp thư phản hồi.');
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (visible) {
      void loadFeedbackInbox();
    }
  }, [visible]);

  // Also load once on mount / when token changes so the badge shows the unread
  // count without requiring the user to open the bell first.
  useEffect(() => {
    if (token) void loadFeedbackInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const unreadCount = useMemo(() => {
    return items.filter((item) => hasManagerReply(item) && !readIds.includes(item._id)).length;
  }, [items, readIds]);

  const handleOpenStream = () => {
    setVisible(true);
  };

  const handleCloseStream = () => {
    setVisible(false);
  };

  const handleOpenItem = (item: FeedbackInboxItem) => {
    setReadIds((current) => (current.includes(item._id) ? current : [...current, item._id]));
    setVisible(false);
    onOpenItem?.(item);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.bellButton}
        onPress={handleOpenStream}
        activeOpacity={0.75}
      >
        {unreadCount > 0 ? (
          <BellRing size={20} color={Colors.primary} strokeWidth={2.2} />
        ) : (
          <Bell size={20} color={Colors.textMuted} strokeWidth={2.2} />
        )}
        {unreadCount > 0 ? (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseStream}
      >
        <Pressable style={styles.overlay} onPress={handleCloseStream}>
          <Pressable style={styles.panel} onPress={() => undefined}>
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <View style={styles.headerIconWrap}>
                  <BellRing size={18} color={Colors.primary} strokeWidth={2.2} />
                </View>
                <View>
                  <Text style={styles.headerTitle}>Hộp thư phản hồi</Text>
                  <Text style={styles.headerSubtitle}>Phản hồi mới nhất từ quản lý bãi xe</Text>
                </View>
              </View>

              <TouchableOpacity onPress={handleCloseStream} style={styles.closeButton}>
                <X size={18} color={Colors.textMuted} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.stateBox}>
                <Text style={styles.stateText}>Đang tải phản hồi...</Text>
              </View>
            ) : error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : items.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Inbox size={30} color={Colors.textDim} strokeWidth={2.1} />
                </View>
                <Text style={styles.emptyTitle}>Hộp thư trống</Text>
                <Text style={styles.emptyDescription}>
                  Bạn chưa có phản hồi nào.
                </Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
              >
                {items.map((item) => {
                  const isRead = readIds.includes(item._id);
                  const hasAttachments = Boolean(item.portraitImageUrl || item.plateImageUrl);

                  return (
                    <TouchableOpacity
                      key={item._id}
                      style={[
                        styles.messageCard,
                        !isRead && styles.messageCardUnread,
                      ]}
                      onPress={() => handleOpenItem(item)}
                      activeOpacity={0.82}
                    >
                      <View style={styles.messageHeaderRow}>
                        <View style={styles.messageIconWrap}>
                          <MessageCircleReply size={18} color={Colors.primary} strokeWidth={2.1} />
                        </View>
                        <View style={styles.messageHeaderTextWrap}>
                          <Text style={styles.buildingName} numberOfLines={1}>
                            {resolveBuildingName(item)}
                          </Text>
                          <Text style={styles.metaText} numberOfLines={1}>
                            {resolvePlate(item)} • {formatDateTime(item.updatedAt || item.createdAt)}
                          </Text>
                        </View>
                        {!isRead ? <View style={styles.unreadBadge} /> : null}
                      </View>

                      <View style={styles.ratingRow}>
                        <Text style={styles.ratingLabel}>Đánh giá:</Text>
                        <Text style={styles.ratingValue}>{item.rating}/5 sao</Text>
                      </View>

                      {hasAttachments ? (
                        <View style={styles.attachmentsRow}>
                          {item.portraitImageUrl ? (
                            <View style={styles.attachmentItem}>
                              <Image source={{ uri: item.portraitImageUrl }} style={styles.attachmentThumb} resizeMode="cover" />
                              <Text style={styles.attachmentLabel}>Chân dung</Text>
                            </View>
                          ) : null}
                          {item.plateImageUrl ? (
                            <View style={styles.attachmentItem}>
                              <Image source={{ uri: item.plateImageUrl }} style={styles.attachmentThumb} resizeMode="cover" />
                              <Text style={styles.attachmentLabel}>Biển số</Text>
                            </View>
                          ) : null}
                        </View>
                      ) : null}

                      <Text style={styles.replyText} numberOfLines={3}>
                        {item.staffReply}
                      </Text>

                      <View style={styles.footerRow}>
                        <Text style={styles.repliedByText} numberOfLines={1}>
                          Phản hồi bởi: {item.repliedBy?.fullName || 'Quản lý bãi xe'}
                        </Text>
                        <Text style={styles.readStateText}>
                          {isRead ? 'Đã đọc' : 'Mới'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellButton: {
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: Colors.error,
    borderWidth: 1.5,
    borderColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 13,
    textAlign: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.72)',
    justifyContent: 'flex-start',
    paddingTop: 88,
    paddingHorizontal: Spacing.lg,
  },
  panel: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: '78%',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.md,
    color: Colors.text,
    fontWeight: '900',
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: FontSize.xs,
    color: Colors.textDim,
    fontWeight: '600',
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Colors.cardAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateBox: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing['2xl'],
    alignItems: 'center',
  },
  stateText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  errorBox: {
    margin: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.errorBg,
    borderColor: Colors.errorBorder,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: 48,
  },
  emptyIconWrap: {
    width: 68,
    height: 68,
    borderRadius: Radius.full,
    backgroundColor: Colors.cardAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.base,
    color: Colors.text,
    fontWeight: '800',
  },
  emptyDescription: {
    marginTop: 6,
    fontSize: FontSize.sm,
    color: Colors.textDim,
    fontWeight: '600',
    textAlign: 'center',
  },
  listContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  messageCard: {
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  messageCardUnread: {
    borderColor: 'rgba(249,115,22,0.3)',
    backgroundColor: 'rgba(249,115,22,0.08)',
  },
  messageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  messageIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(249,115,22,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageHeaderTextWrap: {
    flex: 1,
    gap: 2,
  },
  buildingName: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  metaText: {
    color: Colors.textDim,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  unreadBadge: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.error,
    marginTop: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingLabel: {
    color: Colors.textDim,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  ratingValue: {
    color: Colors.amber,
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  replyText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 20,
    fontWeight: '600',
  },
  attachmentsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 4,
  },
  attachmentItem: {
    alignItems: 'center',
    gap: 4,
  },
  attachmentThumb: {
    width: 64,
    height: 64,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardAlt,
  },
  attachmentLabel: {
    color: Colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  repliedByText: {
    flex: 1,
    color: Colors.textDim,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  readStateText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
