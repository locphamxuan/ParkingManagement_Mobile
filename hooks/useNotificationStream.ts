import { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { listMyFeedbackInbox, type FeedbackInboxItem } from '../services/feedback';

const READ_IDS_KEY_PREFIX = 'pbms_feedback_read_ids:';

function readIdsKeyFor(token: string): string {
  return READ_IDS_KEY_PREFIX + (token ? token.slice(-16) : 'anon');
}

function hasManagerReply(item: FeedbackInboxItem): boolean {
  return Boolean(item.staffReply && item.staffReply.trim().length > 0);
}

export interface UseNotificationStreamResult {
  items: FeedbackInboxItem[];
  readIds: string[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  reload: () => void;
  markRead: (id: string) => void;
}

export function useNotificationStream(token: string): UseNotificationStreamResult {
  const [items, setItems] = useState<FeedbackInboxItem[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Load persisted read state when token changes (login/logout).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(readIdsKeyFor(token));
        if (cancelled || !mounted.current) return;
        const parsed = raw ? JSON.parse(raw) : [];
        setReadIds(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
      } catch {
        if (!cancelled && mounted.current) setReadIds([]);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  // Persist read state on change.
  useEffect(() => {
    void AsyncStorage.setItem(readIdsKeyFor(token), JSON.stringify(readIds)).catch(() => undefined);
  }, [readIds, token]);

  const reload = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listMyFeedbackInbox(token);
      if (!mounted.current) return;
      setItems(data.filter(hasManagerReply));
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'Unable to load feedback inbox.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  // Initial load and reload on token change.
  useEffect(() => {
    if (token) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const markRead = (id: string) => {
    setReadIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const unreadCount = useMemo(
    () => items.filter((item) => !readIds.includes(item._id)).length,
    [items, readIds],
  );

  return { items, readIds, unreadCount, loading, error, reload, markRead };
}
