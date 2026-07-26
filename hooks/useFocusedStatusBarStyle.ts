import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle, type StatusBarStyle } from 'expo-status-bar';

/**
 * Applies a status-bar style while the screen is focused and restores the app
 * default (`dark`) on blur — screens with a blue gradient header behind the
 * status bar need light content, the white pages need dark.
 */
export function useFocusedStatusBarStyle(style: StatusBarStyle) {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(style);
      return () => setStatusBarStyle('dark');
    }, [style]),
  );
}
