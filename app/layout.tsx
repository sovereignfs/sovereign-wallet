import type { ReactNode } from 'react';
import { registerPortabilityHandlers } from './_lib/portability';

export default async function WalletLayout({ children }: { children: ReactNode }) {
  // In-process and reset on restart — the platform SDK requires
  // re-registering from a request-scoped plugin route, so this runs on
  // every request to any Wallet page. A registration failure must not
  // block Wallet's own UI.
  try {
    await registerPortabilityHandlers();
  } catch {
    // best-effort platform integration
  }

  return children;
}
