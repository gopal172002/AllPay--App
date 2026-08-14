import {isSaneAmountPaise, paiseToRupeeLabel, parseRupeeInputToPaise} from '../../src/upi/money';

describe('money', () => {
  it('stores ₹500.25 as 50025 paise', () => {
    expect(parseRupeeInputToPaise('500.25')).toBe(50025);
    expect(paiseToRupeeLabel(50025)).toBe('500.25');
  });

  it('rejects float-like junk', () => {
    expect(parseRupeeInputToPaise('12.345')).toBeNull();
    expect(parseRupeeInputToPaise('-1')).toBeNull();
  });

  it('enforces sane limits', () => {
    expect(isSaneAmountPaise(100)).toBe(true);
    expect(isSaneAmountPaise(99)).toBe(false);
    expect(isSaneAmountPaise(10_000_001)).toBe(false);
  });
});
