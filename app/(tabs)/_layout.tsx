import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { Colors, FontSize } from '../../constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(
  focused: boolean,
  activeIcon: IoniconName,
  inactiveIcon: IoniconName,
  color: string | number | symbol,
) {
  return <Ionicons name={focused ? activeIcon : inactiveIcon} size={22} color={String(color)} />;
}

export default function TabsLayout() {
  const { session } = useAuthStore();
  const role = session?.role;
  const isManager = role === 'manager' || role === 'admin';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textDim,
        tabBarLabelStyle: {
          fontSize: FontSize.xs,
          fontWeight: '700',
          letterSpacing: 0.3,
        },
      }}
    >
      {/* ─── Manager hidden: client Home tab ───────────────────────── */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          href: isManager ? null : '/',
          tabBarIcon: ({ focused, color }) =>
            tabIcon(focused, 'home', 'home-outline', color),
        }}
      />

      {/* ─── Role-protected: Manager Dashboard tab ─────────────────── */}
      <Tabs.Screen
        name="manager"
        options={{
          title: 'Manager',
          href: isManager ? '/manager' : null,
          tabBarIcon: ({ focused, color }) =>
            tabIcon(focused, 'briefcase', 'briefcase-outline', color),
        }}
      />

      {/* ─── Manager hidden: Reservation tab ───────────────────────── */}
      <Tabs.Screen
        name="reservations"
        options={{
          title: 'Reserve',
          href: isManager ? null : '/reservations',
          tabBarIcon: ({ focused, color }) =>
            tabIcon(focused, 'calendar', 'calendar-outline', color),
        }}
      />

      {/* ─── Manager hidden: History tab ───────────────────────────── */}
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          href: isManager ? null : '/history',
          tabBarIcon: ({ focused, color }) =>
            tabIcon(focused, 'time', 'time-outline', color),
        }}
      />

      {/* ─── Manager hidden: Wallet tab ────────────────────────────── */}
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          href: isManager ? null : '/wallet',
          tabBarIcon: ({ focused, color }) =>
            tabIcon(focused, 'wallet', 'wallet-outline', color),
        }}
      />

      {/* ─── Manager hidden: Packages tab ──────────────────────────── */}
      <Tabs.Screen
        name="packages"
        options={{
          title: 'Packages',
          href: isManager ? null : '/packages',
          tabBarIcon: ({ focused, color }) =>
            tabIcon(focused, 'cube', 'cube-outline', color),
        }}
      />

      {/* ─── Visible for all roles: Profile tab ────────────────────── */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused, color }) =>
            tabIcon(focused, 'person', 'person-outline', color),
        }}
      />

      {/* ─── Manager sub-screens — hidden from tab bar ─────────────── */}
      <Tabs.Screen
        name="manager/floors"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="manager/wallet"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="manager/shifts"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="manager/history"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="manager/feedback"
        options={{ href: null }}
      />
    </Tabs>
  );
}