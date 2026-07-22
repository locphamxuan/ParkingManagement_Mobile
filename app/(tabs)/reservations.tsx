import { Redirect } from 'expo-router';

// Màn "đặt chỗ trước theo giờ" đã bị BE bỏ (2026-07-16); tab này chuyển hẳn sang
// luồng mua gói dài hạn ở /(tabs)/packages. Giữ route để các deep-link/nav cũ
// (`router.push('/(tabs)/reservations', ...)`) không vỡ — chỉ redirect.
// Cây wizard cũ (ReservationWizard/WizardStep*/useReservations) hiện KHÔNG còn màn
// nào render (packages.tsx có luồng subscribe riêng) — chờ quyết định xoá/tái dùng.
export default function ReservationsScreen() {
  return <Redirect href="/(tabs)/packages" />;
}
