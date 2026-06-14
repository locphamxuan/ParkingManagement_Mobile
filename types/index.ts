// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface LicensePlate {
  _id?: string;
  plateNumber: string;
  vehicleType: 'car' | 'motorcycle';
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

// ─── Reservations ─────────────────────────────────────────────────────────────
export interface ReservationGate {
  _id: string;
  code: string;
  name?: string;
  direction: 'in' | 'out' | 'both';
}

export interface Reservation {
  _id: string;
  code?: string;
  buildingId?: string;
  building?: { _id: string; name: string; address?: { fullAddress?: string } };
  slot?: { _id: string; code: string; floor?: { _id: string; name?: string; code?: string } | string };
  vehicleType?: { _id: string; name: string } | string;
  plateNumber: string;
  startTime: string;
  endTime?: string;
  /** 15% deposit charged to the user's wallet when booking. */
  fee?: number;
  /** Total estimated fee for the full reservation duration (100%). */
  estimatedFee?: number;
  /** Entry gate(s) the user should use, resolved from the slot's floor. */
  gates?: ReservationGate[];
  status: 'pending' | 'confirmed' | 'checked_in' | 'completed' | 'cancelled' | 'expired';
  createdAt: string;
  refundPercent?: number;
  refundAmount?: number;
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
  allowDedicatedSlot?: boolean;
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
  building?: { _id: string; name: string; code?: string; address?: { fullAddress?: string } } | null;
  slot?: { _id: string; code: string; floor?: { _id: string; name?: string; code?: string } | string } | null;
}
