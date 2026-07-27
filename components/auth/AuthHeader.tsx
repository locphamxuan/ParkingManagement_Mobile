import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { styles } from '../../styles/screens/authForm';
import { BrandMark } from '../ui/BrandMark';

interface AuthHeaderProps {
  backLabel: string;
  onBack: () => void;
  title: string;
  subtitle?: string;
}

/** Back link + centred PBMS mark + title/subtitle — shared by every white auth page. */
export function AuthHeader({ backLabel, onBack, title, subtitle }: AuthHeaderProps) {
  return (
    <>
      <TouchableOpacity
        onPress={onBack}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="chevron-back" size={20} color={Colors.primary} />
        <Text style={styles.backText}>{backLabel}</Text>
      </TouchableOpacity>

      <View style={styles.brand}>
        <BrandMark size={56} />
        <Text style={styles.cardTitle} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={styles.cardSub}>{subtitle}</Text> : null}
      </View>
    </>
  );
}
