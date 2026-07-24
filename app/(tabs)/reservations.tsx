import { Redirect } from 'expo-router';

// Màn "đặt chỗ trước theo giờ" đã bị BE bỏ (2026-07-16); tab này chuyển hẳn sang
// luồng mua gói dài hạn ở /(tabs)/packages. Giữ route để các deep-link/nav cũ
// (`router.push('/(tabs)/reservations', ...)`) không vỡ — chỉ redirect.
// Cây wizard cũ (ReservationWizard/WizardStep*/useReservations) đã bị xoá hẳn
// (2026-07-23, audit toàn diện) — không màn nào render, packages.tsx có luồng
// subscribe() riêng.
export default function ReservationsScreen() {
  return <Redirect href="/(tabs)/packages" />;
}
