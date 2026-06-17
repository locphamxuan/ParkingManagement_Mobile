import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Bell, BellRing, Inbox, MessageCircleReply, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import { styles } from './NotificationBellStream.styles';
import { listMyFeedbackInbox, type FeedbackInboxItem } from '../../services/feedbackInbox';

interface NotificationBellStreamProps {
  token: string;
  onOpenItem?: (item: FeedbackInboxItem) => void;
}

function formatDateTime(value?: string): string {
  if (!value) return 'Just updated';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just updated';
  return date.toLocaleString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: 'short',
  });
}

function resolveBuildingName(item: FeedbackInboxItem): string {
  return item.building?.name || item.building?.code || 'PBMS Parking';
}

function resolvePlate(item: FeedbackInboxItem): string {
  return item.parkingSession?.plateNumber || 'No plate';
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
      setError(err instanceof Error ? err.message : 'Unable to load feedback inbox.');
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
        <Inbox size={20} color={unreadCount > 0 ? Colors.primary : Colors.textMuted} strokeWidth={2.2} />
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
                  <Inbox size={18} color={Colors.primary} strokeWidth={2.2} />
                </View>
                <View>
                  <Text style={styles.headerTitle}>Feedback Inbox</Text>
                  <Text style={styles.headerSubtitle}>Latest replies from parking management</Text>
                </View>
              </View>

              <TouchableOpacity onPress={handleCloseStream} style={styles.closeButton}>
                <X size={18} color={Colors.textMuted} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.stateBox}>
                <Text style={styles.stateText}>Loading replies...</Text>
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
                <Text style={styles.emptyTitle}>Inbox Empty</Text>
                <Text style={styles.emptyDescription}>
                  You have no feedback replies yet.
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
                        <Text style={styles.ratingLabel}>Rating:</Text>
                        <Text style={styles.ratingValue}>{item.rating}/5 stars</Text>
                      </View>

                      {hasAttachments ? (
                        <View style={styles.attachmentsRow}>
                          {item.portraitImageUrl ? (
                            <View style={styles.attachmentItem}>
                              <Image source={{ uri: item.portraitImageUrl }} style={styles.attachmentThumb} resizeMode="cover" />
                              <Text style={styles.attachmentLabel}>Portrait</Text>
                            </View>
                          ) : null}
                          {item.plateImageUrl ? (
                            <View style={styles.attachmentItem}>
                              <Image source={{ uri: item.plateImageUrl }} style={styles.attachmentThumb} resizeMode="cover" />
                              <Text style={styles.attachmentLabel}>Plate</Text>
                            </View>
                          ) : null}
                        </View>
                      ) : null}

                      <Text style={styles.replyText} numberOfLines={3}>
                        {item.staffReply}
                      </Text>

                      <View style={styles.footerRow}>
                        <Text style={styles.repliedByText} numberOfLines={1}>
                          Replied by: {item.repliedBy?.fullName || 'Parking Manager'}
                        </Text>
                        <Text style={styles.readStateText}>
                          {isRead ? 'Read' : 'New'}
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
