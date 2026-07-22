import { apiRequest, type ApiRes } from './api';

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
