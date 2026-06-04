import { apiRequest } from './api';
import type { ParkingSession } from '../types';

export async function listParkingHistory(token: string): Promise<ParkingSession[]> {
  const res = await apiRequest<any>('/users/parking-history', { token });
  const sessions = res?.data?.items ?? [];  
  return sessions.map((s: any) => ({
    ...s,
    checkIn: s.check_in,
    checkOut: s.check_out,
  }));
}