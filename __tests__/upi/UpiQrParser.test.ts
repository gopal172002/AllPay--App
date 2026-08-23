import {buildUpiPayUri, parseUpiQr} from '../../src/upi/scanner/UpiQrParser';

describe('UpiQrParser', () => {
  it('parses a valid merchant QR with amount', () => {
    const result = parseUpiQr(
      'upi://pay?pa=merchant@upi&pn=ABC%20Store&am=500.00&cu=INR',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payeeVpa).toBe('merchant@upi');
      expect(result.payeeName).toBe('ABC Store');
      expect(result.amountPaise).toBe(50000);
      expect(result.currency).toBe('INR');
    }
  });

  it('parses a person-to-person QR without amount', () => {
    const result = parseUpiQr('upi://pay?pa=friend@oksbi&pn=Ravi');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.amountPaise).toBeUndefined();
      expect(result.payeeVpa).toBe('friend@oksbi');
    }
  });

  it('accepts encoded payee name', () => {
    const result = parseUpiQr('upi://pay?pa=shop@upi&pn=Cafe%20%26%20Co');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payeeName).toContain('Cafe');
    }
  });

  it('rejects missing pa', () => {
    const result = parseUpiQr('upi://pay?pn=Shop&am=10.00');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('MISSING_VPA');
    }
  });

  it('rejects invalid VPA', () => {
    expect(parseUpiQr('upi://pay?pa=not-an-id').ok).toBe(false);
  });

  it('rejects zero and negative amounts', () => {
    expect(parseUpiQr('upi://pay?pa=shop@upi&am=0').ok).toBe(false);
    expect(parseUpiQr('upi://pay?pa=shop@upi&am=-5').ok).toBe(false);
  });

  it('rejects non-INR currency', () => {
    const result = parseUpiQr('upi://pay?pa=shop@upi&am=10.00&cu=USD');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('INVALID_CURRENCY');
    }
  });

  it('rejects malformed URI', () => {
    expect(parseUpiQr('not a uri').ok).toBe(false);
  });

  it('rejects non-UPI QR schemes', () => {
    expect(parseUpiQr('https://evil.example/pay').ok).toBe(false);
    expect(parseUpiQr('javascript:alert(1)').ok).toBe(false);
    expect(parseUpiQr('file:///tmp/x').ok).toBe(false);
    expect(parseUpiQr('intent://scan/#Intent;end').ok).toBe(false);
  });

  it('accepts real merchant QRs whose VPA contains @', () => {
    const result = parseUpiQr(
      'upi://pay?pa=gopal.kalsiya@oksbi&pn=Gopal Store&am=120.00&cu=INR',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payeeVpa).toBe('gopal.kalsiya@oksbi');
      expect(result.payeeName).toBe('Gopal Store');
      expect(result.amountPaise).toBe(12000);
    }
  });

  it('accepts unencoded spaces in payee name', () => {
    const result = parseUpiQr('upi://pay?pa=shop@ybl&pn=Cafe And Co&mc=0000');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payeeName).toBe('Cafe And Co');
    }
  });

  it('accepts a bare VPA QR', () => {
    const result = parseUpiQr('friend@oksbi');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payeeVpa).toBe('friend@oksbi');
    }
  });

  it('accepts Bharat QR / EMV merchant payload', () => {
    const tlv = (id: string, value: string) =>
      `${id}${String(value.length).padStart(2, '0')}${value}`;
    const account = tlv('00', 'com.upi.qr') + tlv('01', 'test@okaxis');
    const qr =
      tlv('00', '01') +
      tlv('01', '12') +
      tlv('29', account) +
      tlv('52', '0000') +
      tlv('53', '356') +
      tlv('54', '120.00') +
      tlv('58', 'IN') +
      tlv('59', 'Test Merchant') +
      tlv('60', 'Mumbai');
    const result = parseUpiQr(qr);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payeeVpa).toBe('test@okaxis');
      expect(result.payeeName).toBe('Test Merchant');
      expect(result.amountPaise).toBe(12000);
    }
  });

  it('accepts Android intent UPI wrappers', () => {
    const result = parseUpiQr(
      'intent://pay?pa=shop@ybl&pn=Shop#Intent;scheme=upi;end',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payeeVpa).toBe('shop@ybl');
    }
  });

  it('accepts phone-number VPA links from WhatsApp paste', () => {
    const link =
      'upi://pay?pa=8962027377@ptsbi&pn=Gopal%20Krishna%20Kalsiya&cu=INR';
    expect(parseUpiQr(link).ok).toBe(true);
    expect(
      parseUpiQr(`[9:17 am, 14/08/2026] Gopal: ${link}`).ok,
    ).toBe(true);
    expect(parseUpiQr(`"${link}"`).ok).toBe(true);
    const parsed = parseUpiQr(link);
    if (parsed.ok) {
      expect(parsed.payeeVpa).toBe('8962027377@ptsbi');
      expect(parsed.payeeName).toBe('Gopal Krishna Kalsiya');
    }
  });

  it('rejects extremely long parameters', () => {
    const longName = 'n'.repeat(200);
    const result = parseUpiQr(`upi://pay?pa=shop@upi&pn=${longName}`);
    expect(result.ok).toBe(false);
  });

  it('ignores unexpected parameters but keeps sanitized payee', () => {
    const result = parseUpiQr(
      'upi://pay?pa=shop@upi&pn=Shop&am=10.00&cu=INR&foo=bar&mc=5812',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sanitizedUri).toContain('pa=shop%40upi');
      expect(result.sanitizedUri).not.toContain('foo=');
      expect(result.category).toBe('food');
    }
  });
});

describe('buildUpiPayUri', () => {
  it('builds minimal P2P intent without app-generated tr or mc', () => {
    const uri = buildUpiPayUri({
      payeeVpa: '9174991503-2@ibl',
      payeeName: 'Krishna Chand Patidar',
      amountPaise: 200,
    });
    expect(uri).toContain('pa=9174991503-2%40ibl');
    expect(uri).toContain('am=2.00');
    expect(uri).toContain('cu=INR');
    expect(uri).not.toContain('tr=');
    expect(uri).not.toContain('mc=');
  });

  it('keeps merchant tr and mc only when supplied from the QR', () => {
    const uri = buildUpiPayUri({
      payeeVpa: 'merchant@upi',
      payeeName: 'ABC Store',
      amountPaise: 50000,
      merchantTransactionRef: 'ORD12345',
      merchantCategoryCode: '5812',
    });
    expect(uri).toContain('tr=ORD12345');
    expect(uri).toContain('mc=5812');
  });
});
