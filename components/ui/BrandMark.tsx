import { Image, StyleSheet, View } from 'react-native';

interface BrandMarkProps {
  /** Edge length of the square mark. */
  size?: number;
}

/** The PBMS "P" app mark — blue gradient rounded square used across auth screens. */
export function BrandMark({ size = 56 }: BrandMarkProps) {
  return (
    <View style={[styles.mark, { width: size, height: size }]}>
      <Image
        source={require('../../assets/pbms-mark-tight.png')}
        style={styles.image}
        resizeMode="contain"
        accessibilityLabel="PBMS"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
});
