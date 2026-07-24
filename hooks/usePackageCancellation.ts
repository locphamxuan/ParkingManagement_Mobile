import { useState } from 'react';
import { cancelSubscription } from '../services/longTerm';
import type { LongTermSubscription } from '../types';

interface UsePackageCancellationParams {
  token: string;
  onCancelled: () => void;
}

/** State + handlers for the "Cancel package" confirmation sheet on My Packages. */
export function usePackageCancellation({ token, onCancelled }: UsePackageCancellationParams) {
  const [cancellingSub, setCancellingSub] = useState<LongTermSubscription | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('no_longer_needed');
  const [cancelNote, setCancelNote] = useState<string>('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelErr, setCancelErr] = useState<string | null>(null);

  const openCancel = (sub: LongTermSubscription) => {
    setCancellingSub(sub);
    setCancelReason('no_longer_needed');
    setCancelNote('');
    setCancelErr(null);
  };

  const closeCancel = () => setCancellingSub(null);

  const handleConfirmCancel = async () => {
    if (!cancellingSub) return;
    if (cancelReason === 'other' && !cancelNote.trim()) {
      setCancelErr('Please enter detailed reason for other option.');
      return;
    }
    setCancelling(true);
    setCancelErr(null);
    try {
      await cancelSubscription(token, cancellingSub._id, cancelReason, cancelNote);
      setCancellingSub(null);
      setCancelReason('no_longer_needed');
      setCancelNote('');
      onCancelled();
    } catch (err) {
      setCancelErr(err instanceof Error ? err.message : 'Failed to cancel package');
    } finally {
      setCancelling(false);
    }
  };

  return {
    cancellingSub, cancelReason, setCancelReason, cancelNote, setCancelNote,
    cancelling, cancelErr, setCancelErr,
    openCancel, closeCancel, handleConfirmCancel,
  };
}
