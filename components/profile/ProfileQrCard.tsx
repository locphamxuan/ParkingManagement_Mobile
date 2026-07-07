import { View, Text, Image } from 'react-native';
import { styles } from '../../styles/screens/profile';

interface ProfileQrCardProps {
  role?: string;
  userId?: string;
}

/** Thẻ QR check-in của member (chỉ hiện với role user có userId). */
export function ProfileQrCard({ role, userId }: ProfileQrCardProps) {
  if (role?.toLowerCase() !== 'user' || !userId) return null;

  return (
    <View style={styles.qrCard}>
      <View style={styles.qrCardHeader}>
        <Text style={styles.qrCardTitle}>My QR Check-in</Text>
        <Text style={styles.qrCardSubtitle}>
          Scan at the gate card-reader to associate your parking session and pay with wallet.
        </Text>
      </View>
      <View style={styles.qrCodeContainer}>
        <Image
          source={{
            uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${userId}`,
          }}
          style={styles.qrImage}
          resizeMode="contain"
        />
      </View>
      <View style={styles.qrInfoTag}>
        <Text style={styles.qrIdText}>MEMBER ID: {userId}</Text>
      </View>
    </View>
  );
}
