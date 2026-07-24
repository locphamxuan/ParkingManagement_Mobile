import { ScrollView, RefreshControl } from 'react-native';
import { Colors } from '../../constants/theme';
import { styles } from '../../styles/screens/packages';
import { SubscriptionCard } from './SubscriptionCard';
import type { LongTermSubscription } from '../../types';

interface MySubscriptionsListProps {
  subscriptions: LongTermSubscription[];
  refreshing: boolean;
  onRefresh: () => void;
  onCancel: (sub: LongTermSubscription) => void;
  onRenew: (sub: LongTermSubscription) => void;
}

/** My Packages tab body: subscriptions with Renew/Cancel actions. */
export function MySubscriptionsList({ subscriptions, refreshing, onRefresh, onCancel, onRenew }: MySubscriptionsListProps) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
      }
      contentContainerStyle={styles.scrollContent}
    >
      {subscriptions.map((sub, idx) => (
        <SubscriptionCard key={sub._id} sub={sub} index={idx} onCancel={onCancel} onRenew={onRenew} />
      ))}
    </ScrollView>
  );
}
