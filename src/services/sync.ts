import {Platform} from 'react-native';
import type {OnboardingProfile, Transaction} from '../types';

export type MobileSyncProfile = Pick<OnboardingProfile, 'employeeName' | 'department'>;

/**
 * Base URL for AllPay-Dashboard backend (`/api` prefix included).
 * - Android emulator: 10.0.2.2 maps to the host machine.
 * - iOS simulator: localhost is the Mac/PC host.
 * - Physical device: replace with your machine's LAN IP, e.g. http://192.168.1.10:5000/api
 */
const API_BASE = Platform.select({
  android: 'http://10.0.2.2:5000/api',
  ios: 'http://localhost:5000/api',
  default: 'http://localhost:5000/api',
});

/**
 * Must match `MOBILE_SYNC_SECRET` in the dashboard backend `.env`.
 * Leave empty only for local dev when the secret is unset (server allows open sync).
 */
const MOBILE_SYNC_SECRET = '';

function mobileHeaders(): Record<string, string> {
  const h: Record<string, string> = {'Content-Type': 'application/json'};
  if (MOBILE_SYNC_SECRET) {
    h['X-AllPay-Sync-Secret'] = MOBILE_SYNC_SECRET;
  }
  return h;
}

export const syncTransactionToBackend = async (
  tx: Transaction,
  profile?: MobileSyncProfile | null,
): Promise<{ok: boolean; backendId: string}> => {
  try {
    const res = await fetch(`${API_BASE}/mobile/transactions/sync`, {
      method: 'POST',
      headers: mobileHeaders(),
      body: JSON.stringify({
        transaction: tx,
        ...(profile?.employeeName
          ? {
              employeeName: profile.employeeName,
              department: profile.department,
            }
          : {}),
      }),
    });
    const raw = await res.text();
    if (!res.ok) {
      return {ok: false, backendId: ''};
    }
    const data = raw ? (JSON.parse(raw) as {ok?: boolean; backendId?: string}) : {};
    return {
      ok: Boolean(data.ok),
      backendId: data.backendId ?? tx.id,
    };
  } catch {
    return {ok: false, backendId: ''};
  }
};

/** Partial update (reimbursement, receipts, status) for an existing server row. */
export const patchTransactionOnBackend = async (
  transactionId: string,
  body: Record<string, unknown>,
  profile?: MobileSyncProfile | null,
): Promise<boolean> => {
  try {
    const res = await fetch(
      `${API_BASE}/mobile/transactions/${encodeURIComponent(transactionId)}`,
      {
        method: 'PATCH',
        headers: mobileHeaders(),
        body: JSON.stringify({
          ...body,
          ...(profile?.employeeName
            ? {
                employeeName: profile.employeeName,
                department: profile.department,
              }
            : {}),
        }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
};
