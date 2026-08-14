export function createUuid(): string {
  const cryptoObj = globalThis.crypto as {randomUUID?: () => string} | undefined;
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** UPI `tr` is short; used to correlate the callback with the initiated payment. */
export function launchTxnRefFromPaymentId(paymentId: string): string {
  const compact = paymentId.replace(/-/g, '').toUpperCase();
  return `EXP${compact.slice(0, 12)}`;
}
