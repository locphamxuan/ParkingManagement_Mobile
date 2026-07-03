// Loại xe cho biển số (đồng bộ với enum User.licensePlates.vehicleType ở backend).
export type PlateVehicleType =
  | 'motorcycle'
  | 'car'
  | 'ebike'
  | 'emotorbike'
  | 'suv'
  | 'truck'
  | 'other';

export interface VehiclePreset {
  value: PlateVehicleType;
  label: string;
}

export const VEHICLE_PRESETS: VehiclePreset[] = [
  { value: 'motorcycle', label: 'Xe máy' },
  { value: 'car', label: 'Ô tô' },
  { value: 'ebike', label: 'Xe đạp điện' },
  { value: 'emotorbike', label: 'Xe máy điện' },
  { value: 'suv', label: 'SUV' },
  { value: 'truck', label: 'Xe tải' },
  { value: 'other', label: 'Khác' },
];

export const PLATE_TYPE_LABELS: Record<string, string> = {
  motorcycle: 'Xe máy',
  car: 'Ô tô',
  ebike: 'Xe đạp điện',
  emotorbike: 'Xe máy điện',
  suv: 'SUV',
  truck: 'Xe tải',
  other: 'Khác',
};

// Danh mục chính khi thêm biển: Ô tô / Xe máy / Khác.
export const VEHICLE_CATEGORIES: VehiclePreset[] = [
  { value: 'car', label: 'Ô tô' },
  { value: 'motorcycle', label: 'Xe máy' },
  { value: 'other', label: 'Khác' },
];

// Hãng xe gợi ý cho ô tô / xe máy (chọn từ dropdown; "Khác" cho nhập tay).
export const CAR_BRANDS: string[] = [
  'Toyota', 'Honda', 'Hyundai', 'Kia', 'Mazda', 'Ford', 'Mitsubishi',
  'VinFast', 'Mercedes-Benz', 'BMW', 'Suzuki', 'Nissan', 'Khác',
];

export const MOTO_BRANDS: string[] = [
  'Honda', 'Yamaha', 'Suzuki', 'Piaggio', 'SYM', 'VinFast', 'Vespa', 'Kawasaki', 'Khác',
];
