import { apiRequest } from './api';
import type { LicensePlate, PlateVehicleType } from '../types';

interface ApiPlatesRes {
  data?: { licensePlates?: LicensePlate[] };
}

export async function addPlate(
  token: string,
  plateNumber: string,
  vehicleType: PlateVehicleType,
  brand?: string | null,
): Promise<LicensePlate[]> {
  const res = await apiRequest<ApiPlatesRes>('/users/license-plates', {
    method: 'POST',
    body: {
      plateNumber: plateNumber.trim().toUpperCase(),
      vehicleType,
      ...(brand ? { brand: brand.trim() } : {}),
    },
    token,
  });
  return res?.data?.licensePlates ?? [];
}

export async function removePlate(token: string, plateId: string): Promise<LicensePlate[]> {
  const res = await apiRequest<ApiPlatesRes>(`/users/license-plates/${plateId}`, {
    method: 'DELETE',
    token,
  });
  return res?.data?.licensePlates ?? [];
}

export async function setDefaultPlate(token: string, plateId: string): Promise<LicensePlate[]> {
  const res = await apiRequest<ApiPlatesRes>(`/users/license-plates/${plateId}/default`, {
    method: 'PATCH',
    token,
  });
  return res?.data?.licensePlates ?? [];
}
