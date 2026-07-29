// ─── Auth ─────────────────────────────────────────────────────────────────────
export type PlateVehicleType =
  | 'motorcycle' | 'car' | 'ebike' | 'emotorbike' | 'suv' | 'truck' | 'other';

export interface LicensePlate {
  _id?: string;
  plateNumber: string;
  vehicleType: PlateVehicleType;
  isDefault?: boolean;
  qrCode?: string;
}

export interface AuthSession {
  token: string;
  userId: string;
  role: 'admin' | 'manager' | 'staff' | 'user';
  email: string;
  displayName: string;
  phone?: string;
  licensePlates?: LicensePlate[];
}

// ─── Wallet ───────────────────────────────────────────────────────────────────
export interface WalletInfo {
  balance: number;
}

/** Kết quả trả về khi tạo lệnh nạp ví qua PayOS */
export interface TopupResult {
  checkoutUrl: string;  // URL trang thanh toán PayOS
  qrCode: string;       // VietQR data string or URL
  orderCode: number;    // Mã đơn hàng PayOS
  bin?: string;
  accountNumber?: string;
  accountName?: string;
  description?: string;
  amount: number;
}

export interface WalletTransaction {
  _id: string;
  type: 'topup' | 'payment' | 'refund' | 'credit' | 'debit';
  amount: number;
  description?: string;
  reason?: string;
  createdAt: string;
}

// ─── Parking History ──────────────────────────────────────────────────────────
export interface ParkingSession {
  _id: string;
  plateNumber: string;
  vehicleType?: 'car' | 'motorcycle';
  building?: { _id: string; name: string };
  slot?: { code: string };
  checkIn: string;
  checkOut?: string;
  fee?: number;
  paymentMethod?: string;
  status: 'active' | 'completed';
}

// ─── Long-Term ────────────────────────────────────────────────────────────────
export interface LongTermPackage {
  _id: string;
  name: string;
  durationDays: number;
  price: number;
  description?: string;
  maxHoursPerDay?: number;
  graceDays?: number;
  vehicleType?: { _id: string; name: string; code: string } | 'car' | 'motorcycle' | 'all' | null;
  isActive?: boolean;
  building?: {
    _id: string;
    name: string;
    code: string;
    address?: { fullAddress?: string };
  } | null;
}

export interface LongTermSubscription {
  _id: string;
  package: LongTermPackage | null;
  plateNumber: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  slotReleased?: boolean;
  building?: { _id: string; name: string; code?: string; address?: { fullAddress?: string } } | null;
  slot?: { _id: string; code: string; floor?: { _id: string; name?: string; code?: string } | string } | null;
  /** Snapshot % và số tiền đã hoàn lúc hủy (theo refund policy của toà thời điểm đó) — null với gói cũ. */
  refundPercent?: number | null;
  refundAmount?: number | null;
  updatedAt?: string;
}

// ─── Notifications ─────────────────────────────────────────────────────────────
export interface Notification {
  _id: string;
  user: string;
  type:
    | 'checkin_rejected'
    | 'checkout_rejected'
    | 'subscription_expiring'
    | 'subscription_expired'
    | 'subscription_slot_released'
    | 'subscription_overage'
    | 'feedback_reply'
    | 'general';
  title: string;
  message: string;
  plateNumber?: string | null;
  building?: string | null;
  isRead: boolean;
  createdAt: string;
}
