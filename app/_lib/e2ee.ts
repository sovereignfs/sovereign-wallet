'use server';

import { sdk } from '@sovereignfs/sdk';
import type { E2eeDeviceEnrollment, E2eeProfile } from '@sovereignfs/sdk';

export interface E2eeStatus {
  profile: E2eeProfile | null;
  devices: E2eeDeviceEnrollment[];
}

/** The current user's client-side encryption profile + device enrollments (RFC 0060). */
export async function getE2eeStatus(): Promise<E2eeStatus> {
  const [profile, devices] = await Promise.all([sdk.e2ee.getProfile(), sdk.e2ee.listDevices()]);
  return { profile, devices };
}
