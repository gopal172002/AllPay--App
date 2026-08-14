import type {PaymentStatus} from '../types';

/** True when an expense may be submitted for reimbursement. */
export function isPaymentCaptured(status: PaymentStatus | undefined): boolean {
  return (
    status === 'payment_captured' ||
    status === 'legacy_simulated' ||
    status === 'SUCCESS_REPORTED' ||
    status === 'USER_CONFIRMED'
  );
}
