import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { apiRequest } from '@/services/api';
import { listBuildings, getBuildingVehicleTypes } from '@/services/buildingLookup';

jest.mock('@/services/api', () => ({ apiRequest: jest.fn() }));

const request = apiRequest as jest.MockedFunction<typeof apiRequest>;
const root = path.resolve(__dirname, '../..');
const read = (relative: string) => readFileSync(path.join(root, relative), 'utf8');

/**
 * Đặt chỗ theo giờ KHÔNG còn là tính năng: không tab, không route, không CTA.
 * Các helper dùng chung trước đây nằm dưới thư mục tên "reservations" đã được đổi
 * tên/di chuyển — test này chốt cả hai điều: mất tính năng, GIỮ nguyên hạ tầng gói.
 */
describe('reservation removal', () => {
  it('has no reservations tab route file', () => {
    expect(existsSync(path.join(root, 'app/(tabs)/reservations.tsx'))).toBe(false);
    expect(existsSync(path.join(root, 'components/reservations'))).toBe(false);
  });

  it('registers no reservations screen in the tab layout', () => {
    expect(read('app/(tabs)/_layout.tsx')).not.toContain('reservations');
  });

  it.each(['app/(tabs)/index.tsx', 'app/(tabs)/packages.tsx', 'components/home/HomeNotificationsModal.tsx'])(
    'shows no reservation copy or deep link in %s',
    (file) => {
      expect(read(file).toLowerCase()).not.toMatch(/reservation|pre-book|prebook/);
    },
  );
});

describe('package infrastructure kept after the folder rename', () => {
  beforeEach(() => jest.clearAllMocks());

  it('still resolves the fixed-slot picker used by the subscribe flow', () => {
    expect(existsSync(path.join(root, 'components/packages/SlotMapModal.tsx'))).toBe(true);
    expect(read('components/packages/SubscribeModal.tsx')).toContain("from './SlotMapModal'");
  });

  it('keeps the shared building lookup contract', async () => {
    request.mockResolvedValueOnce({ data: { items: [{ _id: 'b1', code: 'B1', name: 'Building 1' }] } });
    await expect(listBuildings('token')).resolves.toHaveLength(1);
    expect(request).toHaveBeenCalledWith('/users/buildings', { token: 'token' });

    request.mockResolvedValueOnce({ data: { items: [] } });
    await getBuildingVehicleTypes('token', 'b1');
    expect(request).toHaveBeenLastCalledWith('/users/buildings/b1/vehicle-types', { token: 'token' });
  });
});
