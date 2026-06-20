import type {OnboardingProfile, Transaction} from '../types';
import {authHeaders} from './auth';
import {API_BASE} from './apiConfig';

export type MobileSyncProfile = Pick<OnboardingProfile, 'employeeName' | 'department'>;

export const syncTransactionToBackend = async (
  tx: Transaction,
  profile?: MobileSyncProfile | null,
): Promise<{ok: boolean; backendId: string}> => {
  try {
    const res = await fetch(`${API_BASE}/mobile/transactions/sync`, {
      method: 'POST',
      headers: await authHeaders(),
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

export const fetchActivePolicies = async (
  employeeId?: string,
): Promise<{ok: boolean; policies: import('../utils/policies').ExpensePolicy[]}> => {
  try {
    const url = employeeId
      ? `${API_BASE}/mobile/policies?employeeId=${encodeURIComponent(employeeId)}`
      : `${API_BASE}/mobile/policies`;
    const res = await fetch(url, {headers: await authHeaders()});
    const raw = await res.text();
    if (!res.ok) {
      return {ok: false, policies: []};
    }
    const data = raw
      ? (JSON.parse(raw) as {ok?: boolean; policies?: import('../utils/policies').ExpensePolicy[]})
      : {};
    return {ok: Boolean(data.ok), policies: data.policies ?? []};
  } catch {
    return {ok: false, policies: []};
  }
};

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
        headers: await authHeaders(),
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
