import {MerchantData} from '../types';

const MCC_MAP: Record<string, string> = {
  groceries: '5411',
  fuel: '5541',
  travel: '4111',
  food: '5812',
  office: '5045',
};

export const parseUpiQr = (value: string): MerchantData | null => {
  if (!value.toLowerCase().startsWith('upi://pay?')) {
    return null;
  }

  const query = value.slice('upi://pay?'.length);
  const params = new URLSearchParams(query);
  const vpa = params.get('pa') ?? '';
  const name = params.get('pn') ?? 'Unknown Merchant';
  const rawCategory = params.get('tn') ?? 'office';
  const category = rawCategory.toLowerCase().includes('fuel')
    ? 'fuel'
    : rawCategory.toLowerCase().includes('travel')
      ? 'travel'
      : rawCategory.toLowerCase().includes('food')
        ? 'food'
        : rawCategory.toLowerCase().includes('grocery')
          ? 'groceries'
          : 'office';

  if (!vpa.includes('@')) {
    return null;
  }

  const amount = Number(params.get('am'));
  return {
    vpa,
    name,
    category,
    mcc: MCC_MAP[category] ?? '5999',
    amount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
  };
};

export const buildUpiPaymentLink = (
  merchant: MerchantData,
  amount: number,
): string => {
  const params = new URLSearchParams({
    pa: merchant.vpa,
    pn: merchant.name,
    am: amount.toFixed(2),
    cu: 'INR',
    tn: `Allpay payment to ${merchant.name}`,
  });
  return `upi://pay?${params.toString()}`;
};

export const getPolicyWarning = (
  amount: number,
  category: string,
  monthlyFuelRemaining = 500,
): string | null => {
  if (amount > 5000) {
    return `Single transaction limit is INR 5000. You entered INR ${amount.toFixed(2)}.`;
  }

  if (category === 'fuel' && amount > monthlyFuelRemaining) {
    return `Fuel spend limit: INR 3000/month. You have INR ${monthlyFuelRemaining.toFixed(
      2,
    )} remaining.`;
  }

  return null;
};

export const randomRef = (prefix: string): string =>
  `${prefix}${Math.floor(Math.random() * 100000000)}`;
