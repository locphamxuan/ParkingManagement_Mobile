import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius } from '../../constants/theme';
import { useUIStore } from '../../store/uiStore';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_BAR_HEIGHT = 68;

const tabIcon = (focused: boolean, active: IoniconName, inactive: IoniconName, color: string) => (
  <Ionicons name={focused ? active : inactive} size={22} color={color} />
);

export default function TabsLayout() {
  const isTabBarHidden = useUIStore((state) => state.isTabBarHidden);
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          display: isTabBarHidden ? 'none' : 'flex',
          backgroundColor: Colors.card,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarItemStyle: { minHeight: 50, borderRadius: Radius.md, marginHorizontal: 3, paddingVertical: 0 },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textDim,
        tabBarActiveBackgroundColor: Colors.primaryTint,
        tabBarIconStyle: { marginBottom: 0 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', lineHeight: 13, marginTop: 2, marginBottom: 0 },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ focused, color }) => tabIcon(focused, 'home', 'home-outline', color) }} />
      <Tabs.Screen name="packages" options={{ title: 'Packages', tabBarIcon: ({ focused, color }) => tabIcon(focused, 'cube', 'cube-outline', color) }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: ({ focused, color }) => tabIcon(focused, 'time', 'time-outline', color) }} />
      <Tabs.Screen name="wallet" options={{ title: 'Wallet', tabBarIcon: ({ focused, color }) => tabIcon(focused, 'wallet', 'wallet-outline', color) }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ focused, color }) => tabIcon(focused, 'person', 'person-outline', color) }} />
    </Tabs>
  );
}
