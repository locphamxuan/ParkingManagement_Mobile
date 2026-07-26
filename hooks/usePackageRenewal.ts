import { useState } from 'react';
import { renewSubscription } from '../services/longTerm';
import { requiresReplacementSlot, resolveErrorMessage } from '../utils/apiErrors';
import type { LongTermSubscription } from '../types';

interface UsePackageRenewalParams {
  token: string;
  onRenewed: () => void;
}

/**
 * State + handlers for the "Renew package" confirmation sheet on My Packages.
 * Wires the existing `renewSubscription` BE call (already used by FE web) that
 * previously had no Mobile UI caller.
 */
export function usePackageRenewal({ token, onRenewed }: UsePackageRenewalParams) {
  const [renewingSub, setRenewingSub] = useState<LongTermSubscription | null>(null);
  const [renewing, setRenewing] = useState(false);
  const [renewErr, setRenewErr] = useState<string | null>(null);
  const [renewNeedsReplacement, setRenewNeedsReplacement] = useState(false);

  const openRenew = (sub: LongTermSubscription) => {
    setRenewingSub(sub);
    setRenewErr(null);
    setRenewNeedsReplacement(false);
  };

  const closeRenew = () => {
    setRenewingSub(null);
    setRenewErr(null);
    setRenewNeedsReplacement(false);
  };

  const handleConfirmRenew = async () => {
    if (!renewingSub) return;
    setRenewing(true);
    setRenewErr(null);
    try {
      await renewSubscription(token, renewingSub._id);
      setRenewingSub(null);
      onRenewed();
    } catch (err) {
      setRenewNeedsReplacement(requiresReplacementSlot(err));
      setRenewErr(resolveErrorMessage(err, 'Failed to renew package.'));
    } finally {
      setRenewing(false);
    }
  };

  return {
    renewingSub,
    renewing,
    renewErr,
    renewNeedsReplacement,
    openRenew,
    closeRenew,
    handleConfirmRenew,
  };
}
