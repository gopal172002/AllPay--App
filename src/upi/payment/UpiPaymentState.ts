import type {UpiIntentStatus} from '../model/types';
import {UPI_TERMINAL_STATUSES} from '../model/types';

const ALLOWED: Record<UpiIntentStatus, ReadonlySet<UpiIntentStatus>> = {
  INITIATED: new Set([
    'UPI_APP_OPENED',
    'CANCELLED',
    'UNKNOWN',
    'SUCCESS_REPORTED',
    'FAILED',
    'PENDING',
    'USER_CONFIRMED',
  ]),
  UPI_APP_OPENED: new Set([
    'SUCCESS_REPORTED',
    'FAILED',
    'PENDING',
    'CANCELLED',
    'UNKNOWN',
    'USER_CONFIRMED',
  ]),
  PENDING: new Set(['SUCCESS_REPORTED', 'FAILED', 'USER_CONFIRMED', 'PENDING', 'UNKNOWN']),
  UNKNOWN: new Set([
    'SUCCESS_REPORTED',
    'FAILED',
    'USER_CONFIRMED',
    'CANCELLED',
    'UNKNOWN',
  ]),
  SUCCESS_REPORTED: new Set(['SUCCESS_REPORTED']),
  FAILED: new Set(['FAILED']),
  CANCELLED: new Set(['CANCELLED']),
  USER_CONFIRMED: new Set(['USER_CONFIRMED']),
};

export function canTransitionUpiStatus(
  from: UpiIntentStatus,
  to: UpiIntentStatus,
): boolean {
  return ALLOWED[from]?.has(to) ?? false;
}

export function applyUpiStatusTransition(
  from: UpiIntentStatus,
  to: UpiIntentStatus,
): {ok: true; status: UpiIntentStatus} | {ok: false; status: UpiIntentStatus} {
  if (from === to) {
    return {ok: true, status: from};
  }
  if (!canTransitionUpiStatus(from, to)) {
    return {ok: false, status: from};
  }
  return {ok: true, status: to};
}

export function isUpiTerminal(status: UpiIntentStatus): boolean {
  return UPI_TERMINAL_STATUSES.has(status);
}

export function shouldCreateExpense(status: UpiIntentStatus): boolean {
  return status === 'SUCCESS_REPORTED' || status === 'USER_CONFIRMED';
}

/**
 * Process was killed while the user was in an external UPI app.
 * Do not assume success or failure.
 */
export function recoverUnresolvedStatus(status: UpiIntentStatus): UpiIntentStatus {
  if (status === 'INITIATED' || status === 'UPI_APP_OPENED') {
    return 'UNKNOWN';
  }
  return status;
}
