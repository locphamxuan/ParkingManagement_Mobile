import { apiRequest } from './api';

interface ApiRes<T> {
  data?: T;
}

export interface FloorWithAvailability {
  _id: string;
  code: string;
  name: string;
  allowedVehicleTypes: { _id: string; name: string; code: string }[];
  availableSlots: number;
  occupiedSlots: number;
  reservedSlots: number;
  totalSlots: number;
}

export interface SlotItem {
  _id: string;
  code: string;
  status: 'available' | 'occupied' | 'reserved' | 'maintenance';
  vehicleType?: { _id: string; name: string; code?: string };
}

export async function getBuildingFloors(
  token: string,
  buildingId: string,
  vehicleTypeId?: string,
): Promise<FloorWithAvailability[]> {
  const query = vehicleTypeId ? `?vehicleTypeId=${vehicleTypeId}` : '';
  const res = await apiRequest<ApiRes<{ items?: FloorWithAvailability[]; floors?: FloorWithAvailability[] }>>(
    `/users/buildings/${buildingId}/floors${query}`,
    { token },
  );
  return res?.data?.floors ?? res?.data?.items ?? [];
}

export async function getFloorSlots(
  token: string,
  buildingId: string,
  floorId: string,
): Promise<SlotItem[]> {
  const res = await apiRequest<ApiRes<{ items?: SlotItem[]; slots?: SlotItem[] }>>(
    `/users/buildings/${buildingId}/floors/${floorId}/slots`,
    { token },
  );
  return res?.data?.items ?? res?.data?.slots ?? [];
}
