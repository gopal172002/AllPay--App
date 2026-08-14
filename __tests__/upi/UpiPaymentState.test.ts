import {
  applyUpiStatusTransition,
  canTransitionUpiStatus,
  recoverUnresolvedStatus,
  shouldCreateExpense,
} from '../../src/upi/payment/UpiPaymentState';

describe('UpiPaymentState', () => {
  it('allows INITIATED → UPI_APP_OPENED', () => {
    expect(canTransitionUpiStatus('INITIATED', 'UPI_APP_OPENED')).toBe(true);
  });

  it('allows UPI_APP_OPENED to reported outcomes', () => {
    expect(canTransitionUpiStatus('UPI_APP_OPENED', 'SUCCESS_REPORTED')).toBe(true);
    expect(canTransitionUpiStatus('UPI_APP_OPENED', 'FAILED')).toBe(true);
    expect(canTransitionUpiStatus('UPI_APP_OPENED', 'PENDING')).toBe(true);
    expect(canTransitionUpiStatus('UPI_APP_OPENED', 'CANCELLED')).toBe(true);
    expect(canTransitionUpiStatus('UPI_APP_OPENED', 'UNKNOWN')).toBe(true);
  });

  it('blocks FAILED → INITIATED and SUCCESS_REPORTED → INITIATED', () => {
    expect(canTransitionUpiStatus('FAILED', 'INITIATED')).toBe(false);
    expect(canTransitionUpiStatus('SUCCESS_REPORTED', 'INITIATED')).toBe(false);
    expect(applyUpiStatusTransition('SUCCESS_REPORTED', 'INITIATED').ok).toBe(false);
  });

  it('is idempotent for SUCCESS_REPORTED', () => {
    const result = applyUpiStatusTransition('SUCCESS_REPORTED', 'SUCCESS_REPORTED');
    expect(result).toEqual({ok: true, status: 'SUCCESS_REPORTED'});
    expect(shouldCreateExpense('SUCCESS_REPORTED')).toBe(true);
  });

  it('does not treat USER_CONFIRMED as SUCCESS_REPORTED', () => {
    expect(shouldCreateExpense('USER_CONFIRMED')).toBe(true);
    expect('USER_CONFIRMED').not.toBe('SUCCESS_REPORTED');
  });

  it('recovers in-flight payments to UNKNOWN', () => {
    expect(recoverUnresolvedStatus('INITIATED')).toBe('UNKNOWN');
    expect(recoverUnresolvedStatus('UPI_APP_OPENED')).toBe('UNKNOWN');
    expect(recoverUnresolvedStatus('SUCCESS_REPORTED')).toBe('SUCCESS_REPORTED');
  });
});
