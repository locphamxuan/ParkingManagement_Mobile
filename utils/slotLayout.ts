import type { SlotItem } from '../services/floors';

// Layout helper cho sơ đồ bãi 2D/3D, dùng bởi components/packages/SlotMapModal.tsx
// khi khách chọn ô cố định lúc mua gói dài hạn. (File trước có tên
// utils/reservationFormat.ts, đổi tên 2026-07-29 khi gỡ nốt dấu vết tính năng đặt
// chỗ theo giờ — nội dung còn lại không liên quan gì tới đặt chỗ.)

// Chia slot thành 2 hàng đối xứng cho sơ đồ bãi (T1/chẵn ở trên, T2/lẻ ở dưới).
export function splitSlotsSymmetrically(allSlots: SlotItem[]) {
  const cars: SlotItem[] = [];
  const motos: SlotItem[] = [];

  allSlots.forEach((s) => {
    const code = s.code.toUpperCase();
    const vtName = s.vehicleType?.name?.toLowerCase() || '';
    if (code.includes('MOTO') || code.includes('SMW') || code.includes('SMR') || code.startsWith('M') || vtName.includes('moto')) {
      motos.push(s);
    } else {
      cars.push(s);
    }
  });

  if (cars.length > 0 && motos.length > 0) {
    return { topRowSlots: cars, bottomRowSlots: motos };
  }

  const half = Math.ceil(allSlots.length / 2);
  return {
    topRowSlots: allSlots.slice(0, half),
    bottomRowSlots: allSlots.slice(half),
  };
}
