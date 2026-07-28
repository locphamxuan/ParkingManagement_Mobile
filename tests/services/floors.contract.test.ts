import { apiRequest } from '@/services/api';
import { getFloorSlots } from '@/services/floors';

jest.mock('@/services/api', () => ({
  apiRequest: jest.fn(),
}));

const request = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('floor slot API contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('scopes subscriber slots to the package vehicle type', async () => {
    request.mockResolvedValueOnce({ data: { slots: [] } });

    await getFloorSlots('user-token', 'building-1', 'floor-1', 'subscriber', 'vehicle-1');

    expect(request).toHaveBeenCalledWith(
      '/users/buildings/building-1/floors/floor-1/slots?usage=subscriber&vehicleTypeId=vehicle-1',
      { token: 'user-token' },
    );
  });
});
