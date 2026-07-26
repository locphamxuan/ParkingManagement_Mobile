import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearPendingTopupOrder,
  getPendingTopupOrder,
  isTerminalTopupStatus,
  parsePendingOrderCode,
  savePendingTopupOrder,
} from '@/services/pendingTopup';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('pending PayOS top-up storage policy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts only positive safe integer order codes', () => {
    expect(parsePendingOrderCode('12345')).toBe(12345);
    expect(parsePendingOrderCode('0')).toBeNull();
    expect(parsePendingOrderCode('-1')).toBeNull();
    expect(parsePendingOrderCode('not-a-number')).toBeNull();
  });

  it('stores only the order code under a user-specific key', async () => {
    await savePendingTopupOrder('user-7', 98765);

    expect(storage.setItem).toHaveBeenCalledWith(
      'pbms_pending_topup:user-7',
      '98765',
    );
  });

  it('removes malformed stored values', async () => {
    storage.getItem.mockResolvedValueOnce('invalid');

    await expect(getPendingTopupOrder('user-7')).resolves.toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith(
      'pbms_pending_topup:user-7',
    );
  });

  it('clears by user and classifies only terminal PayOS statuses', async () => {
    await clearPendingTopupOrder('user-7');

    expect(storage.removeItem).toHaveBeenCalledWith(
      'pbms_pending_topup:user-7',
    );
    expect(isTerminalTopupStatus('success')).toBe(true);
    expect(isTerminalTopupStatus('cancelled')).toBe(true);
    expect(isTerminalTopupStatus('expired')).toBe(true);
    expect(isTerminalTopupStatus('pending')).toBe(false);
    expect(isTerminalTopupStatus('processing')).toBe(false);
  });
});
