import { useState } from 'react';
import { cancelSubscription, getRefundPreview, type RefundPreview } from '../services/longTerm';
import { resolveErrorMessage } from '../utils/apiErrors';
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
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState<string | null>(null);
  const [refundPreview, setRefundPreview] = useState<RefundPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const openCancel = (sub: LongTermSubscription) => {
    setCancellingSub(sub);
    setCancelReason('no_longer_needed');
    setCancelNote('');
    setCancelErr(null);
    setCancelSuccessMsg(null);
    setRefundPreview(null);
    setLoadingPreview(true);
    getRefundPreview(token, sub._id)
      .then(setRefundPreview)
      .catch(() => setRefundPreview(null))
      .finally(() => setLoadingPreview(false));
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
      const result = await cancelSubscription(token, cancellingSub._id, cancelReason, cancelNote);
      setCancelSuccessMsg(
        `Package cancelled! ${result.refundPercent ?? 0}% refund (${(result.refundAmount ?? 0).toLocaleString('en-US')} VND) credited to your wallet.`
      );
      setTimeout(() => {
        setCancellingSub(null);
        setCancelReason('no_longer_needed');
        setCancelNote('');
        setCancelSuccessMsg(null);
        setRefundPreview(null);
        onCancelled();
      }, 1500);
    } catch (err) {
      setCancelErr(resolveErrorMessage(err, 'Failed to cancel package.'));
    } finally {
      setCancelling(false);
    }
  };

  return {
    cancellingSub, cancelReason, setCancelReason, cancelNote, setCancelNote,
    cancelling, cancelErr, setCancelErr, cancelSuccessMsg,
    refundPreview, loadingPreview,
    openCancel, closeCancel, handleConfirmCancel,
  };
}
