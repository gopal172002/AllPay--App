import {
  mapUpiResultToStatus,
  parseUpiPaymentResult,
} from '../../src/upi/payment/UpiPaymentResultParser';

describe('UpiPaymentResultParser', () => {
  it('parses a typical success callback', () => {
    const parsed = parseUpiPaymentResult(
      'Status=SUCCESS&txnId=412345678901&txnRef=EXP123456&responseCode=00',
    );
    expect(parsed.status).toBe('SUCCESS');
    expect(parsed.transactionId).toBe('412345678901');
    expect(parsed.transactionReference).toBe('EXP123456');
    expect(parsed.responseCode).toBe('00');
    expect(mapUpiResultToStatus(parsed, 'EXP123456')).toBe('SUCCESS_REPORTED');
  });

  it('parses lowercase keys', () => {
    const parsed = parseUpiPaymentResult(
      'status=success&txnid=123&txnref=456&responsecode=00',
    );
    expect(mapUpiResultToStatus(parsed, '456')).toBe('SUCCESS_REPORTED');
  });

  it('maps failure', () => {
    const parsed = parseUpiPaymentResult('Status=FAILURE&responseCode=ZM');
    expect(mapUpiResultToStatus(parsed)).toBe('FAILED');
  });

  it('maps pending / submitted', () => {
    expect(mapUpiResultToStatus(parseUpiPaymentResult('Status=PENDING'))).toBe(
      'PENDING',
    );
    expect(mapUpiResultToStatus(parseUpiPaymentResult('Status=SUBMITTED'))).toBe(
      'PENDING',
    );
  });

  it('maps empty and null to UNKNOWN', () => {
    expect(mapUpiResultToStatus(parseUpiPaymentResult(''))).toBe('UNKNOWN');
    expect(mapUpiResultToStatus(parseUpiPaymentResult(null))).toBe('UNKNOWN');
    expect(mapUpiResultToStatus(parseUpiPaymentResult(undefined))).toBe('UNKNOWN');
  });

  it('maps malformed callback to UNKNOWN', () => {
    expect(mapUpiResultToStatus(parseUpiPaymentResult('?????'))).toBe('UNKNOWN');
  });

  it('does not treat success without any reference as SUCCESS_REPORTED', () => {
    const parsed = parseUpiPaymentResult('Status=SUCCESS');
    expect(mapUpiResultToStatus(parsed)).toBe('UNKNOWN');
  });

  it('rejects txnRef mismatch against the initiated payment', () => {
    const parsed = parseUpiPaymentResult(
      'Status=SUCCESS&txnId=1&txnRef=OTHER&responseCode=00',
    );
    expect(mapUpiResultToStatus(parsed, 'EXP123')).toBe('UNKNOWN');
  });

  it('uses the first value when duplicate fields appear', () => {
    const parsed = parseUpiPaymentResult(
      'Status=SUCCESS&txnId=aaa&txnId=bbb&txnRef=EXP1&responseCode=00',
    );
    expect(parsed.transactionId).toBe('aaa');
  });

  it('flattens a nested response extra', () => {
    const parsed = parseUpiPaymentResult(
      'response=Status%3DSUCCESS%26txnId%3D99%26txnRef%3DEXP1%26responseCode%3D00',
    );
    expect(mapUpiResultToStatus(parsed, 'EXP1')).toBe('SUCCESS_REPORTED');
  });
});
