import { apiRequest, type ApiRes } from './api';
import type { Reservation } from '../types';

export interface BuildingOption {
  _id: string;
  code: string;
  name: string;
  address?: string | { fullAddress?: string };
}

export interface VehicleTypeOption {
  _id: string;
  code: string;
  name: string;
  description?: string;
}

export async function listBuildings(token: string): Promise<BuildingOption[]> {
  const res = await apiRequest<ApiRes<{ items?: BuildingOption[] }>>(
    '/users/buildings',
    { token },
  );
  return res?.data?.items ?? [];
}

export async function listReservations(token: string): Promise<Reservation[]> {
  const res = await apiRequest<ApiRes<{ items?: Reservation[]; reservations?: Reservation[] }>>(
    '/users/reservations',
    { token },
  );
  // Backend returns data.items; fallback to data.reservations for compatibility
  return res?.data?.items ?? res?.data?.reservations ?? [];
}

export interface CreateReservationResult {
  reservation: Reservation;
  depositAmount?: number;
  estimatedFee?: number;
  fee?: number;
}

export async function createReservation(
  token: string,
  data: {
    buildingId: string;
    vehicleTypeId: string;
    plateNumber: string;
    startTime: string;
    endTime: string;
    slotId?: string;
  },
): Promise<CreateReservationResult> {
  const res = await apiRequest<ApiRes<CreateReservationResult>>(
    '/users/reservations',
    { method: 'POST', body: data, token },
  );
  if (!res?.data?.reservation) throw new Error('Reservation creation failed');
  return res.data;
}

export async function getBuildingVehicleTypes(
  token: string,
  buildingId: string,
): Promise<VehicleTypeOption[]> {
  const res = await apiRequest<ApiRes<{ items?: VehicleTypeOption[] }>>(
    `/users/buildings/${buildingId}/vehicle-types`,
    { token },
  );
  return res?.data?.items ?? [];
}

/** Giới hạn đặt chỗ công khai của tòa — dùng ràng buộc date/duration picker TRƯỚC khi chọn giờ. */
export interface ReservationPolicyInfo {
  maxAdvanceDays: number;
  maxDurationHours: number;
  depositPercent: number;
  refundPercent: number;
  cancellationCutoffHours: number;
}

export async function getReservationPolicy(
  token: string,
  buildingId: string,
): Promise<ReservationPolicyInfo> {
  const res = await apiRequest<ApiRes<ReservationPolicyInfo>>(
    `/users/reservations/policy?buildingId=${encodeURIComponent(buildingId)}`,
    { token },
  );
  // Fallback = default của BE khi tòa chưa cấu hình policy.
  return {
    maxAdvanceDays: res?.data?.maxAdvanceDays ?? 7,
    maxDurationHours: res?.data?.maxDurationHours ?? 24,
    depositPercent: res?.data?.depositPercent ?? 15,
    refundPercent: res?.data?.refundPercent ?? 80,
    cancellationCutoffHours: res?.data?.cancellationCutoffHours ?? 0,
  };
}

export async function cancelReservation(token: string, id: string): Promise<{ refund: number; refundPercent?: number; amountPaid?: number }> {
  const res = await apiRequest<ApiRes<{ refund?: number; refundPercent?: number; amountPaid?: number }>>(
    `/users/reservations/${id}`,
    { method: 'DELETE', token },
  );
  return {
    refund: res?.data?.refund ?? 0,
    refundPercent: res?.data?.refundPercent ?? 0,
    amountPaid: res?.data?.amountPaid ?? 0,
  };
}

export async function getReservation(token: string, id: string): Promise<Reservation> {
  const res = await apiRequest<ApiRes<{ reservation?: Reservation }>>(
    `/users/reservations/${id}`,
    { token },
  );
  if (!res?.data?.reservation) throw new Error('Not found');
  return res.data.reservation;
}

export interface FeeEstimate {
  estimatedFee: number;
  depositAmount: number;
  remainingFee: number;
  depositPercent?: number;
  remainingPercent?: number;
  hourlyRate: number;
  hours: number;
  regularHours?: number;
  peakHours?: number;
  peakRate?: number | null;
}

export async function estimateFee(
  token: string,
  buildingId: string,
  vehicleTypeId: string,
  startTime: string,
  endTime: string,
): Promise<FeeEstimate> {
  const params = new URLSearchParams({ buildingId, vehicleTypeId, startTime, endTime });
  const res = await apiRequest<ApiRes<FeeEstimate>>(
    `/users/reservations/estimate?${params}`,
    { token },
  );
  if (!res?.data) throw new Error('Failed to get fee estimate');
  return res.data;
}
