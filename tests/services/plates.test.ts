import { apiRequest } from '@/services/api';
import { listPlates } from '@/services/plates';

jest.mock('@/services/api', () => ({
  apiRequest: jest.fn(),
}));

const request = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('license plate service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads the authoritative list with each plate QR token', async () => {
    request.mockResolvedValueOnce({
      data: {
        licensePlates: [{
          _id: 'plate-1',
          plateNumber: '51F-123.45',
          vehicleType: 'car',
          qrCode: 'PLT-vehicle-token',
        }],
      },
    });

    await expect(listPlates('user-token')).resolves.toEqual([
      expect.objectContaining({
        plateNumber: '51F-123.45',
        qrCode: 'PLT-vehicle-token',
      }),
    ]);
    expect(request).toHaveBeenCalledWith('/users/license-plates', { token: 'user-token' });
  });
});
