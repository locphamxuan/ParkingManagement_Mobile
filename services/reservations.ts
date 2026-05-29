import { apiRequest } from './api';
import type { Reservation } from '../types';

interface ApiRes<T> {
  data?: T;
}

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
  paymentRequired?: boolean;
  fee?: number;
  checkoutUrl?: string;
  orderCode?: number;
}

export async function createReservation(
  token: string,
  data: {
    buildingId: string;
    vehicleTypeId: string;
    plateNumber: string;
    startTime: string;
    endTime?: string;
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

export async function cancelReservation(token: string, id: string): Promise<{ refund: number }> {
  const res = await apiRequest<ApiRes<{ refund?: number }>>(
    `/users/reservations/${id}`,
    { method: 'DELETE', token },
  );
  return { refund: res?.data?.refund ?? 0 };
}

export async function getReservation(token: string, id: string): Promise<Reservation> {
  const res = await apiRequest<ApiRes<{ reservation?: Reservation }>>(
    `/users/reservations/${id}`,
    { token },
  );
  if (!res?.data?.reservation) throw new Error('Not found');
  return res.data.reservation;
}
