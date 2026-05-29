import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing } from '../../constants/theme';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  noHPad?: boolean;
}

export function Screen({ children, scroll = true, style, contentStyle, noHPad = false }: ScreenProps) {
  const content = (
    <View style={[styles.content, noHPad ? null : styles.hPad, contentStyle]}>
      {children}
    </View>
  );

  if (scroll) {
    return (
      <SafeAreaView style={[styles.safe, style]} edges={['top', 'left', 'right']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          {content}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, style]} edges={['top', 'left', 'right']}>
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  content: {
    flex: 1,
    gap: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  hPad: {
    paddingHorizontal: Spacing.lg,
  },
});
