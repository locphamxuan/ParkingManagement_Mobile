import { Redirect, useLocalSearchParams } from 'expo-router';

export default function ReservationsScreen() {
  const params = useLocalSearchParams();
  return <Redirect href={{ pathname: '/(tabs)/packages', params }} />;
}
