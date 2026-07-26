import { ApiError } from '@/services/api';
import {
  getApiErrorCode,
  getApiErrorDetails,
  isSlotSelectionError,
  requiresReplacementSlot,
  resolveErrorMessage,
  resolveSubscriptionErrorMessage,
} from '@/utils/apiErrors';

describe('Mobile API business errors', () => {
  it('maps ownership errors without suggesting a wallet top-up', () => {
    const error = new ApiError(
      'raw backend message',
      403,
      'PLATE_OWNERSHIP_REQUIRED',
    );

    expect(getApiErrorCode(error)).toBe('PLATE_OWNERSHIP_REQUIRED');
    expect(resolveErrorMessage(error)).toContain('registered to your account');
    expect(resolveErrorMessage(error)).not.toContain('wallet');
  });

  it('recognizes a renewal that requires a replacement slot', () => {
    const error = new ApiError(
      'slot unavailable',
      409,
      'FIXED_SLOT_UNAVAILABLE',
      { details: { requiresSlotSelection: true } },
    );

    expect(getApiErrorDetails(error)).toEqual({ requiresSlotSelection: true });
    expect(isSlotSelectionError(error)).toBe(true);
    expect(requiresReplacementSlot(error)).toBe(true);
    expect(resolveErrorMessage(error)).toContain('No fee was deducted');
    expect(resolveSubscriptionErrorMessage(error)).toContain('just taken');
  });

  it('preserves unknown server errors and uses fallback for non-errors', () => {
    expect(
      resolveErrorMessage(new ApiError('Server detail', 409, 'NEW_CODE')),
    ).toBe('Server detail');
    expect(resolveErrorMessage(null, 'Safe fallback')).toBe('Safe fallback');
  });
});
