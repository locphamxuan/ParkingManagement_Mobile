import { apiRequest, type ApiRes } from './api';

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
  selectable?: boolean;
  reservable?: boolean;
  usageType?: string;
  owner?: { plateNumber: string; accountName: string | null } | null;
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
  usage: string = 'subscriber',
  vehicleTypeId?: string,
): Promise<SlotItem[]> {
  const params = new URLSearchParams();
  if (usage) params.set('usage', usage);
  if (vehicleTypeId) params.set('vehicleTypeId', vehicleTypeId);
  const queryString = params.toString();
  const query = queryString ? `?${queryString}` : '';
  const res = await apiRequest<ApiRes<{ items?: SlotItem[]; slots?: SlotItem[] }>>(
    `/users/buildings/${buildingId}/floors/${floorId}/slots${query}`,
    { token },
  );
  return res?.data?.items ?? res?.data?.slots ?? [];
}
