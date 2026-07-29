import React from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { styles } from '../../styles/screens/index';
import type { Notification } from '../../types';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface HomeNotificationsModalProps {
  visible: boolean;
  onClose: () => void;
  notifications: Notification[];
  onNotificationTap: (notif: Notification) => void;
  unreadCount?: number;
  onMarkAllRead?: () => void;
}

/** Modal danh sách thông báo của màn Home. */
export function HomeNotificationsModal({ visible, onClose, notifications, onNotificationTap, unreadCount = 0, onMarkAllRead }: HomeNotificationsModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, styles.notifModalContent]}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="notifications" size={20} color={Colors.primary} />
              <Text style={styles.modalTitle}>NOTIFICATIONS</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              {unreadCount > 0 && onMarkAllRead && (
                <TouchableOpacity onPress={onMarkAllRead}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.primary }}>Mark all read</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={styles.notifList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingBottom: 10 }}
          >
            {notifications.length === 0 ? (
              <View style={styles.emptyNotifContainer}>
                <Ionicons name="notifications-off-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyNotifText}>No notifications yet</Text>
              </View>
            ) : (
              notifications.map((notif) => {
                const iconInfo = (() => {
                  switch (notif.type) {
                    case 'checkin_rejected':
                    case 'checkout_rejected':
                      return { name: 'close-circle-outline' as IoniconName, color: Colors.error };
                    case 'subscription_expired':
                    case 'subscription_slot_released':
                      return { name: 'alert-circle-outline' as IoniconName, color: Colors.error };
                    case 'subscription_expiring':
                    case 'subscription_overage':
                      return { name: 'warning-outline' as IoniconName, color: Colors.warning };
                    case 'feedback_reply':
                      return { name: 'chatbubble-ellipses-outline' as IoniconName, color: Colors.blue };
                    default:
                      return { name: 'notifications-outline' as IoniconName, color: Colors.primary };
                  }
                })();
                return (
                  <TouchableOpacity
                    key={notif._id}
                    style={[
                      styles.notifItem,
                      !notif.isRead && styles.notifItemUnread,
                    ]}
                    onPress={() => onNotificationTap(notif)}
                  >
                    <View style={styles.notifIconContainer}>
                      <Ionicons name={iconInfo.name} size={20} color={iconInfo.color} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.notifTitle, !notif.isRead && styles.notifTitleUnread]} numberOfLines={1}>
                          {notif.title}
                        </Text>
                        {!notif.isRead && <View style={styles.unreadDot} />}
                      </View>
                      <Text style={styles.notifMessage} numberOfLines={3}>
                        {notif.message}
                      </Text>
                      <Text style={styles.notifTime}>
                        {new Date(notif.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
