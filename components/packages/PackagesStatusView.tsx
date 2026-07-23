import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { styles } from '../../styles/screens/packages';

interface PackagesStatusViewProps {
  kind: 'loading' | 'error' | 'empty' | 'empty-filtered';
  activeTab: 'browse' | 'my';
  error?: string | null;
  onRetry: () => void;
  onClearFilters: () => void;
}

/** Loading/error/empty/empty-filtered placeholder shared by Browse & My Packages tabs. */
export function PackagesStatusView({ kind, activeTab, error, onRetry, onClearFilters }: PackagesStatusViewProps) {
  if (kind === 'loading') {
    return (
      <View style={styles.center}>
        <Text style={styles.dimText}>Loading...</Text>
      </View>
    );
  }

  if (kind === 'error') {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={32} color={Colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={onRetry} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (kind === 'empty') {
    return (
      <View style={styles.center}>
        <Ionicons name="cube-outline" size={40} color={Colors.textDim} />
        <Text style={styles.dimText}>
          {activeTab === 'browse' ? 'No packages available.' : 'You have not subscribed to any packages yet.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <Ionicons name="search-outline" size={40} color={Colors.textDim} />
      <Text style={styles.dimText}>No items match your search/filters.</Text>
      <TouchableOpacity onPress={onClearFilters} style={styles.retryBtn}>
        <Text style={styles.retryText}>Clear Filters</Text>
      </TouchableOpacity>
    </View>
  );
}
