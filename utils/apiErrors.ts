import { ApiError } from '../services/api';

const ERROR_MESSAGES: Record<string, string> = {
  INSUFFICIENT_WALLET_BALANCE:
    'Insufficient wallet balance. Please top up and try again.',

  VEHICLE_CURRENTLY_PARKED:
    'Cannot cancel this package while the vehicle is parked. Check it out first.',
  CANCELLATION_WINDOW_EXPIRED:
    'The self-cancellation window has expired. Please contact the building manager.',
  FIXED_SLOT_UNAVAILABLE:
    'Your previous fixed slot is no longer available. No fee was deducted. Choose another package and optional fixed slot, or contact the building manager.',
  FIXED_SLOT_OCCUPIED:
    'Your fixed slot is currently occupied. Please check the vehicle out first.',

  PLATE_OWNERSHIP_REQUIRED:
    'That license plate is not registered to your account. Add it in Profile first.',
  PLATE_HAS_ACTIVE_SUBSCRIPTION:
    'This plate has an active long-term package. Cancel it or wait for it to expire before removing the plate.',
  PLATE_HAS_ACTIVE_SESSION:
    'This vehicle is currently parked. Check it out before removing the plate.',
  VEHICLE_TYPE_CONFLICT:
    'The vehicle type cannot be changed while this plate has an active package or parking session.',

  INVALID_SLOT: 'The selected parking slot is invalid. Please choose another slot.',
  SLOT_NOT_FOUND: 'The selected parking slot no longer exists. Please choose another slot.',
  SLOT_NOT_AVAILABLE: 'That slot was just taken. The slot map has been refreshed.',
  SLOT_USAGE_MISMATCH:
    'That slot is not available for long-term packages. Please choose another slot.',
  SLOT_VEHICLE_TYPE_MISMATCH:
    'That slot does not support this vehicle type. Please choose another slot.',
  SLOT_NOT_RESERVABLE:
    'That slot cannot be reserved. Please choose another slot.',
  SLOT_MAINTENANCE_NOT_AVAILABLE:
    'That slot is under maintenance. Please choose another slot.',

  BUILDING_INACTIVE: 'This building is not accepting new entries right now.',
  BUILDING_MAINTENANCE: 'This building is under maintenance.',
  BUILDING_CLOSED: 'This building is currently outside its operating hours.',
  BUILDING_REQUIRED: 'Select a building before performing this action.',
};

const SLOT_SELECTION_ERROR_CODES = new Set([
  'FIXED_SLOT_UNAVAILABLE',
  'INVALID_SLOT',
  'SLOT_NOT_FOUND',
  'SLOT_NOT_AVAILABLE',
  'SLOT_USAGE_MISMATCH',
  'SLOT_VEHICLE_TYPE_MISMATCH',
  'SLOT_NOT_RESERVABLE',
  'SLOT_MAINTENANCE_NOT_AVAILABLE',
]);

export function getApiErrorCode(error: unknown): string | undefined {
  return error instanceof ApiError ? error.errorCode : undefined;
}

export function getApiErrorDetails(
  error: unknown,
): Record<string, unknown> | undefined {
  if (!(error instanceof ApiError) || !error.payload || typeof error.payload !== 'object') {
    return undefined;
  }

  const details = (error.payload as { details?: unknown }).details;
  return details && typeof details === 'object'
    ? details as Record<string, unknown>
    : undefined;
}

export function resolveErrorMessage(
  error: unknown,
  fallback = 'An unexpected error occurred. Please try again.',
): string {
  const code = getApiErrorCode(error);
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  return error instanceof Error ? error.message : fallback;
}

export function isSlotSelectionError(error: unknown): boolean {
  const code = getApiErrorCode(error);
  return Boolean(code && SLOT_SELECTION_ERROR_CODES.has(code));
}

export function resolveSubscriptionErrorMessage(error: unknown): string {
  if (getApiErrorCode(error) === 'FIXED_SLOT_UNAVAILABLE') {
    return 'That fixed slot was just taken. No fee was deducted. The slot map has been refreshed.';
  }
  return resolveErrorMessage(error, 'Subscription failed. Please try again.');
}

export function requiresReplacementSlot(error: unknown): boolean {
  return getApiErrorCode(error) === 'FIXED_SLOT_UNAVAILABLE'
    && getApiErrorDetails(error)?.requiresSlotSelection === true;
}
