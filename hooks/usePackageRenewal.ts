import { useState } from 'react';
import { renewSubscription } from '../services/longTerm';
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

  const openRenew = (sub: LongTermSubscription) => {
    setRenewingSub(sub);
    setRenewErr(null);
  };

  const closeRenew = () => setRenewingSub(null);

  const handleConfirmRenew = async () => {
    if (!renewingSub) return;
    setRenewing(true);
    setRenewErr(null);
    try {
      await renewSubscription(token, renewingSub._id);
      setRenewingSub(null);
      onRenewed();
    } catch (err) {
      setRenewErr(err instanceof Error ? err.message : 'Failed to renew package');
    } finally {
      setRenewing(false);
    }
  };

  return { renewingSub, renewing, renewErr, openRenew, closeRenew, handleConfirmRenew };
}
