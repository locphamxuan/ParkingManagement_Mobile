import { apiRequest } from './api';
import type { ParkingSession } from '../types';

export async function listParkingHistory(token: string): Promise<ParkingSession[]> {
  const res = await apiRequest<{
    data?: { sessions?: ParkingSession[] };
  }>('/users/parking-history', { token });
  return res?.data?.sessions ?? [];
}
