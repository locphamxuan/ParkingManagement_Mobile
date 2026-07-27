import { apiRequest } from './api';
import type { ParkingSession } from '../types';

export async function listParkingHistory(token: string): Promise<ParkingSession[]> {
  const res = await apiRequest<any>('/users/parking-history', { token });
  // BE trả sẵn checkIn/checkOut (map từ entryTime/exitTime) — trước đây map nhầm
  // sang s.check_in/s.check_out (field không tồn tại) khiến checkIn/checkOut luôn
  // undefined, làm hỏng cả hiển thị giờ vào/ra lẫn bộ lọc theo khoảng ngày.
  return res?.data?.items ?? [];
}