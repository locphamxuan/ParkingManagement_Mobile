import { apiRequest } from './api';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ManagerBuilding {
  _id: string;
  name: string;
  code: string;
  address?: {
    street?: string;
    ward?: string;
    district?: string;
    city?: string;
    fullAddress?: string;
  };
  contactPhone?: string;
  totalFloors?: number;
  status?: 'active' | 'inactive' | 'maintenance';
}

export interface DashboardStats {
  totalSlots: number;
  availableSlots: number;
  occupiedSlots: number;
  todayRevenue: number;
  activeStaff: number;
  totalReservations?: number;
  todayCheckins?: number;
  todayCheckouts?: number;
  occupancyRate?: number;
  floors?: number;
  gates?: number;
  pendingFeedbacks?: number;
}

export interface ManagerDashboardData {
  building: ManagerBuilding;
  dashboard: DashboardStats;
}

// ─── API Functions ──────────────────────────────────────────────────────────

/**
 * Fetch the manager's assigned building(s).
 * GET /api/manager/buildings
 */
export async function getManagerBuildings(
  token: string,
): Promise<{ data?: ManagerBuilding[] }> {
  return apiRequest<{ data?: ManagerBuilding[] }>('/manager/buildings', {
    token,
  });
}

/**
 * Fetch dashboard overview statistics for a specific building.
 * GET /api/manager/buildings/:buildingId/dashboard
 *
 * The backend returns a nested structure:
 *   { success: true, data: {
 *       slots: { total, available, occupied, occupancyRate },
 *       revenue: { today, byMethod, weekly },
 *       sessions: { active, today },
 *       floors, gates,
 *       subscriptions: { active },
 *       feedbacks: { pending },
 *     }
 *   }
 *
 * We map it into the flat DashboardStats interface so the screen
 * can access stats.totalSlots, stats.availableSlots, etc.
 */
export async function getBuildingDashboard(
  buildingId: string,
  token: string,
): Promise<{ data?: DashboardStats }> {
  const raw = await apiRequest<{
    success: boolean;
    data: {
      slots?: { total?: number; available?: number; occupied?: number; occupancyRate?: number };
      revenue?: { today?: number; byMethod?: Record<string, unknown>; weekly?: unknown[] };
      sessions?: { active?: number; today?: number };
      floors?: number;
      gates?: number;
      subscriptions?: { active?: number };
      feedbacks?: { pending?: number };
    };
  }>(`/manager/buildings/${buildingId}/dashboard`, { token });

  // If no data returned, bail out
  if (!raw?.data) return { data: undefined };

  const d = raw.data;

  // Flatten the nested structure into DashboardStats
  const mapped: DashboardStats = {
    totalSlots: d.slots?.total ?? 0,
    availableSlots: d.slots?.available ?? 0,
    occupiedSlots: d.slots?.occupied ?? 0,
    occupancyRate: d.slots?.occupancyRate ?? 0,
    todayRevenue: d.revenue?.today ?? 0,
    // activeStaff is not provided by the overview endpoint yet;
    // fall back to active parking sessions as a proxy
    activeStaff: d.sessions?.active ?? 0,
    totalReservations: d.subscriptions?.active ?? 0,
    todayCheckins: d.sessions?.today ?? 0,
    todayCheckouts: 0, // not available from overview
    floors: d.floors ?? 0,
    gates: d.gates ?? 0,
    pendingFeedbacks: d.feedbacks?.pending ?? 0,
  };

  return { data: mapped };
}

// ─── Floor & Slot Types ─────────────────────────────────────────────────────

export interface ManagerFloor {
  _id: string;
  building?: string;
  name: string;
  code: string;
  levelNumber: number;
  capacity: number;
  allowedVehicleTypes?: string[];
  pricePolicy?: string | null;
  status?: 'active' | 'inactive' | 'maintenance';
  createdAt?: string;
  updatedAt?: string;
  // backward-compat aliases kept for any older references
  floorNumber?: number;
  totalSlots?: number;
}

export interface FloorInput {
  code: string;
  name: string;
  levelNumber: number;
  capacity: number;
  allowedVehicleTypes?: string[];
  pricePolicy?: string | null;
  status?: 'active' | 'inactive' | 'maintenance';
}

export type SlotStatus = 'available' | 'occupied' | 'reserved' | 'maintenance';

export interface ParkingSlot {
  _id: string;
  building?: string;
  floor: string | { _id: string; name?: string; levelNumber?: number };
  code: string;
  vehicleType?: string | { _id: string; name?: string; code?: string };
  status: SlotStatus;
  reservable?: boolean;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
  // backward-compat alias
  slotNumber?: string;
}

export interface FloorSlotCount {
  floorId: string;
  floorName: string;
  total: number;
  available: number;
  occupied: number;
}

// ─── Floor & Slot API Functions ─────────────────────────────────────────────

/**
 * List all floors for a building.
 * GET /api/manager/buildings/:buildingId/floors
 * Response shape: { success, data: { items: ManagerFloor[] } }
 */
export async function getFloors(buildingId: string, token: string) {
  const raw = await apiRequest<{ success: boolean; data: { items: ManagerFloor[] } }>(
    `/manager/buildings/${buildingId}/floors`,
    { token },
  );
  return { data: raw };
}

/**
 * Create a new floor.
 * POST /api/manager/buildings/:buildingId/floors
 */
export async function createFloor(
  buildingId: string,
  token: string,
  input: FloorInput,
) {
  const raw = await apiRequest<{ success: boolean; message: string; data: { item: ManagerFloor } }>(
    `/manager/buildings/${buildingId}/floors`,
    { method: 'POST', token, body: input },
  );
  return { data: raw };
}

/**
 * Update an existing floor.
 * PUT /api/manager/buildings/:buildingId/floors/:id
 */
export async function updateFloor(
  buildingId: string,
  floorId: string,
  token: string,
  input: Partial<FloorInput>,
) {
  const raw = await apiRequest<{ success: boolean; message: string; data: { item: ManagerFloor } }>(
    `/manager/buildings/${buildingId}/floors/${floorId}`,
    { method: 'PUT', token, body: input },
  );
  return { data: raw };
}

/**
 * Delete a floor.
 * DELETE /api/manager/buildings/:buildingId/floors/:id
 */
export async function deleteFloor(buildingId: string, floorId: string, token: string) {
  const raw = await apiRequest<{ success: boolean; message: string; data: null }>(
    `/manager/buildings/${buildingId}/floors/${floorId}`,
    { method: 'DELETE', token },
  );
  return { data: raw };
}

/**
 * List all parking slots for a building, optionally filtered by floor.
 * GET /api/manager/buildings/:buildingId/slots?floor=xxx
 * Response shape: { success, data: { items: ParkingSlot[] } }
 */
export async function getSlots(
  buildingId: string,
  token: string,
  floorId?: string,
) {
  const query = floorId ? `?floor=${encodeURIComponent(floorId)}` : '';
  const raw = await apiRequest<{ success: boolean; data: { items: ParkingSlot[] } }>(
    `/manager/buildings/${buildingId}/slots${query}`,
    { token },
  );
  return { data: raw };
}

/**
 * Update a slot's status.
 * PATCH /api/manager/buildings/:buildingId/slots/:slotId/status
 * Response shape: { success, message, data: { item: ParkingSlot } }
 */
export async function updateSlotStatus(
  buildingId: string,
  slotId: string,
  token: string,
  status: SlotStatus,
) {
  const raw = await apiRequest<{
    success: boolean;
    message: string;
    data: { item: ParkingSlot };
  }>(`/manager/buildings/${buildingId}/slots/${slotId}/status`, {
    method: 'PATCH',
    token,
    body: { status },
  });
  return { data: raw };
}

// ─── Wallet Types ─────────────────────────────────────────────────────────────

export interface BuildingWallet {
  _id: string;
  building: string;
  balance: number;
  totalReceived: number;
  totalTransferred: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DailyRevenue {
  date: string;
  totalRevenue: number;
  parkingFees: number;
  reservationFees: number;
  sessionCount?: number;
}

export interface WalletTransaction {
  _id: string;
  building: string;
  type: 'credit' | 'debit';
  amount: number;
  balanceAfter: number;
  reason: string;
  relatedPayment?: string;
  performedBy?: string;
  note?: string | null;
  createdAt: string;
}

export interface TransactionListResponse {
  items: WalletTransaction[];
  total: number;
  page: number;
  limit: string;
}

// ─── Wallet API Functions ────────────────────────────────────────────────────

/**
 * Fetch building wallet info (balance, totalReceived, totalTransferred).
 * GET /api/manager/buildings/:buildingId/wallet
 */
export async function getBuildingWallet(
  buildingId: string,
  token: string,
): Promise<{ data?: { wallet?: BuildingWallet } }> {
  return apiRequest<{ data?: { wallet?: BuildingWallet } }>(
    `/manager/buildings/${buildingId}/wallet`,
    { token },
  );
}

/**
 * Fetch today's daily revenue breakdown.
 * GET /api/manager/buildings/:buildingId/wallet/daily-revenue
 */
export async function getBuildingDailyRevenue(
  buildingId: string,
  token: string,
  date?: string,
): Promise<{ data?: DailyRevenue }> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiRequest<{ data?: DailyRevenue }>(
    `/manager/buildings/${buildingId}/wallet/daily-revenue${query}`,
    { token },
  );
}

/**
 * List wallet transactions with pagination.
 * GET /api/manager/buildings/:buildingId/wallet/transactions
 */
export async function getBuildingTransactions(
  buildingId: string,
  token: string,
  page = 1,
  limit = 20,
): Promise<{ data?: TransactionListResponse }> {
  return apiRequest<{ data?: TransactionListResponse }>(
    `/manager/buildings/${buildingId}/wallet/transactions?page=${page}&limit=${limit}`,
    { token },
  );
}

// ─── Shift & Staff Types ────────────────────────────────────────────────────

export interface BaseShift {
  _id: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  building?: string;
  isActive?: boolean;
  status?: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
}

export interface ShiftInput {
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  isActive?: boolean;
}

export interface StaffMember {
  _id: string;
  fullName: string;
  email: string;
  phone?: string;
  role?: string;
  building?: string;
  isActive?: boolean;
  status?: 'active' | 'inactive';
}

export interface StaffShift {
  _id: string;
  building: string;
  staff: StaffMember | string;
  shift: BaseShift | string;
  workDate: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  note?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface StaffShiftInput {
  staff: string;
  shift: string;
  workDate: string;
  status?: 'scheduled' | 'active' | 'completed' | 'cancelled';
  note?: string;
}

export interface StaffShiftUpdateInput {
  shift?: string;
  staff?: string;
  workDate?: string;
  status?: 'scheduled' | 'active' | 'completed' | 'cancelled';
  note?: string;
}

// ─── Shift & Staff API Functions ────────────────────────────────────────────

/**
 * List all base shifts for a building.
 * GET /api/manager/buildings/:buildingId/shifts
 * Response shape: { success, data: { items: BaseShift[] } }
 */
export async function getBuildingShifts(buildingId: string, token: string) {
  const raw = await apiRequest<{ success: boolean; data: { items: BaseShift[] } }>(
    `/manager/buildings/${buildingId}/shifts`,
    { token },
  );
  return { data: raw };
}

/**
 * Create a new base shift.
 * POST /api/manager/buildings/:buildingId/shifts
 */
export async function createShift(
  buildingId: string,
  token: string,
  input: ShiftInput,
) {
  const raw = await apiRequest<{ success: boolean; message: string; data: { item: BaseShift } }>(
    `/manager/buildings/${buildingId}/shifts`,
    { method: 'POST', token, body: input },
  );
  return { data: raw };
}

/**
 * Update a base shift.
 * PUT /api/manager/buildings/:buildingId/shifts/:id
 */
export async function updateShift(
  buildingId: string,
  shiftId: string,
  token: string,
  input: Partial<ShiftInput>,
) {
  const raw = await apiRequest<{ success: boolean; message: string; data: { item: BaseShift } }>(
    `/manager/buildings/${buildingId}/shifts/${shiftId}`,
    { method: 'PUT', token, body: input },
  );
  return { data: raw };
}

/**
 * Delete a base shift.
 * DELETE /api/manager/buildings/:buildingId/shifts/:id
 */
export async function deleteShift(buildingId: string, shiftId: string, token: string) {
  const raw = await apiRequest<{ success: boolean; message: string; data: null }>(
    `/manager/buildings/${buildingId}/shifts/${shiftId}`,
    { method: 'DELETE', token },
  );
  return { data: raw };
}

/**
 * List staff-shift schedules, filterable by workDate.
 * GET /api/manager/buildings/:buildingId/staff-shifts?workDate=YYYY-MM-DD
 * Response shape: { success, data: { items: StaffShift[], total, page, limit } }
 */
export async function getBuildingStaffShifts(
  buildingId: string,
  token: string,
  workDate?: string,
) {
  const query = workDate ? `?workDate=${encodeURIComponent(workDate)}` : '';
  const raw = await apiRequest<{
    success: boolean;
    data: { items: StaffShift[]; total: number; page: number; limit: number };
  }>(`/manager/buildings/${buildingId}/staff-shifts${query}`, { token });
  return { data: raw };
}

/**
 * List available staff members for a building.
 * GET /api/manager/buildings/:buildingId/staff
 * Response shape: { success, data: { items: StaffMember[] } }
 */
export async function getBuildingStaff(buildingId: string, token: string) {
  const raw = await apiRequest<{ success: boolean; data: { items: StaffMember[] } }>(
    `/manager/buildings/${buildingId}/staff`,
    { token },
  );
  return { data: raw };
}

/**
 * Assign a staff member to a shift on a specific date.
 * POST /api/manager/buildings/:buildingId/staff-shifts
 */
export async function assignStaffShift(
  buildingId: string,
  token: string,
  input: StaffShiftInput,
) {
  const raw = await apiRequest<{ success: boolean; message: string; data: { item: StaffShift } }>(
    `/manager/buildings/${buildingId}/staff-shifts`,
    { method: 'POST', token, body: input },
  );
  return { data: raw };
}

/**
 * Update an existing staff-shift assignment.
 * PUT /api/manager/buildings/:buildingId/staff-shifts/:id
 */
export async function updateStaffShift(
  buildingId: string,
  staffShiftId: string,
  token: string,
  input: StaffShiftUpdateInput,
) {
  const raw = await apiRequest<{ success: boolean; message: string; data: { item: StaffShift } }>(
    `/manager/buildings/${buildingId}/staff-shifts/${staffShiftId}`,
    { method: 'PUT', token, body: input },
  );
  return { data: raw };
}

/**
 * Delete a staff-shift assignment.
 * DELETE /api/manager/buildings/:buildingId/staff-shifts/:id
 */
export async function deleteStaffShift(
  buildingId: string,
  staffShiftId: string,
  token: string,
) {
  const raw = await apiRequest<{ success: boolean; message: string; data: null }>(
    `/manager/buildings/${buildingId}/staff-shifts/${staffShiftId}`,
    { method: 'DELETE', token },
  );
  return { data: raw };
}

// ─── Shift Revenue Types ────────────────────────────────────────────────────

export interface ShiftRevenueItem {
  _id: string;
  building: string;
  staff: {
    _id: string;
    fullName: string;
    email?: string;
    phone?: string;
  };
  shift: {
    _id: string;
    name: string;
    code?: string;
    startTime: string;
    endTime: string;
  };
  workDate: string;
  sessionCount: number;
  totalRevenue: number;
  cashAmount: number;
  walletAmount: number;
  qrAmount: number;
  reconciled: boolean;
  reconciledAt?: string;
  reconciledBy?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Shift Revenue API Functions ────────────────────────────────────────────

/**
 * List all shift revenues submitted by staff for a building.
 * GET /api/manager/buildings/:buildingId/shift-revenues
 */
export async function getShiftRevenues(
  buildingId: string,
  token: string,
): Promise<{ data?: ShiftRevenueItem[] }> {
  return apiRequest<{ data?: ShiftRevenueItem[] }>(
    `/manager/buildings/${buildingId}/shift-revenues`,
    { token },
  );
}

// ─── Feedback Types ─────────────────────────────────────────────────────────

export type FeedbackStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface FeedbackItem {
  _id: string;
  building: string;
  user: {
    _id: string;
    fullName: string;
  };
  rating: number;         // 1-5
  subject: string;
  content: string;
  response?: string;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackUpdateInput {
  response: string;
  status: FeedbackStatus;
}

// ─── Feedback API Functions ─────────────────────────────────────────────────

/**
 * List customer feedbacks for a building.
 * GET /api/manager/buildings/:buildingId/feedbacks
 */
export async function getFeedbacks(
  buildingId: string,
  token: string,
): Promise<{ data?: FeedbackItem[] }> {
  return apiRequest<{ data?: FeedbackItem[] }>(
    `/manager/buildings/${buildingId}/feedbacks`,
    { token },
  );
}

/**
 * Submit a response to a feedback and update its status.
 * PATCH /api/manager/buildings/:buildingId/feedbacks/:id
 */
export async function respondToFeedback(
  buildingId: string,
  feedbackId: string,
  token: string,
  input: FeedbackUpdateInput,
): Promise<{ data?: FeedbackItem }> {
  return apiRequest<{ data?: FeedbackItem }>(
    `/manager/buildings/${buildingId}/feedbacks/${feedbackId}`,
    {
      method: 'PATCH',
      token,
      body: input,
    },
  );
}