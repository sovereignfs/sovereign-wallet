'use client';

import { useEffect, useState } from 'react';
import type { E2eeState } from '@sovereignfs/sdk';
import { unwrapCmkWithDeviceKey } from '@sovereignfs/sdk/e2ee-crypto';
import { getE2eeLocalState } from '@sovereignfs/sdk/e2ee-state';
import { getE2eeStatus } from './e2ee';

export interface E2eeUnlock {
  /** `'checking'` is a local UI-only state before the status fetch + unlock check resolves. */
  state: 'checking' | E2eeState;
  /** The unwrapped Client Master Key for this device, present only when `state === 'unlocked'`. */
  cmk: CryptoKey | null;
}

/**
 * Resolves this device's client-side encryption unlock state (RFC 0060) for
 * Wallet's encrypted-card flows. Fetches the profile/device-enrollment
 * metadata server-side, then classifies and unwraps the CMK entirely in the
 * browser — the server never sees the CMK or any decrypted card data.
 */
export function useE2eeUnlock(): E2eeUnlock {
  const [result, setResult] = useState<E2eeUnlock>({ state: 'checking', cmk: null });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { profile, devices } = await getE2eeStatus();
      const local = await getE2eeLocalState(profile, devices);
      if (cancelled) return;
      if (local.state !== 'unlocked' || !local.deviceKey || !local.activeEnrollment) {
        setResult({ state: local.state, cmk: null });
        return;
      }
      try {
        const cmk = await unwrapCmkWithDeviceKey(
          {
            wrappedCmk: local.activeEnrollment.wrappedCmk,
            algorithmVersion: local.activeEnrollment.algorithmVersion,
          },
          local.deviceKey,
        );
        if (!cancelled) setResult({ state: 'unlocked', cmk });
      } catch {
        if (!cancelled) setResult({ state: 'locked', cmk: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return result;
}
