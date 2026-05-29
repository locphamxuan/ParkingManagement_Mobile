import { apiRequest } from './api';
import type { LicensePlate } from '../types';

interface ApiPlatesRes {
  data?: { licensePlates?: LicensePlate[] };
}

export async function listPlates(token: string): Promise<LicensePlate[]> {
  const res = await apiRequest<ApiPlatesRes>('/users/license-plates', { token });
  return res?.data?.licensePlates ?? [];
}

export async function addPlate(
  token: string,
  plateNumber: string,
  vehicleType: 'car' | 'motorcycle',
): Promise<LicensePlate[]> {
  const res = await apiRequest<ApiPlatesRes>('/users/license-plates', {
    method: 'POST',
    body: { plateNumber: plateNumber.trim().toUpperCase(), vehicleType },
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
