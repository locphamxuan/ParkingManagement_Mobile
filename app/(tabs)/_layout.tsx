import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize } from '../../constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(
  focused: boolean,
  activeIcon: IoniconName,
  inactiveIcon: IoniconName,
  color: any,
) {
  return <Ionicons name={focused ? activeIcon : inactiveIcon} size={22} color={color} />;
}

export default function TabsLayout() {
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
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color }) =>
            tabIcon(focused, 'home', 'home-outline', color),
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          title: 'Reserve',
          tabBarIcon: ({ focused, color }) =>
            tabIcon(focused, 'calendar', 'calendar-outline', color),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ focused, color }) =>
            tabIcon(focused, 'time', 'time-outline', color),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ focused, color }) =>
            tabIcon(focused, 'wallet', 'wallet-outline', color),
        }}
      />
      <Tabs.Screen
        name="packages"
        options={{
          title: 'Packages',
          tabBarIcon: ({ focused, color }) =>
            tabIcon(focused, 'cube', 'cube-outline', color),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused, color }) =>
            tabIcon(focused, 'person', 'person-outline', color),
        }}
      />
    </Tabs>
  );
}
