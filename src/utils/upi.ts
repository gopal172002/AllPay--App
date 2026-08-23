import {MerchantData} from '../types';
import {paiseToRupeeLabel} from '../upi/money';
import type {UpiQrParseOk} from '../upi/model/types';
import {parseUpiQr as parseValidatedUpiQr} from '../upi/scanner/UpiQrParser';

const MCC_MAP: Record<string, string> = {
  groceries: '5411',
  fuel: '5541',
  travel: '4111',
  food: '5812',
  office: '5045',
};

export function merchantFromUpiQr(parsed: UpiQrParseOk): MerchantData {
  const amountRupees = parsed.amountPaise
    ? Number(paiseToRupeeLabel(parsed.amountPaise))
    : undefined;
  const category = parsed.category;
  return {
    vpa: parsed.payeeVpa,
    name: parsed.payeeName,
    category,
    mcc: parsed.merchantCategoryCode ?? MCC_MAP[category] ?? '0000',
    ...(amountRupees !== undefined ? {amount: amountRupees} : {}),
    ...(parsed.amountPaise !== undefined ? {amountPaise: parsed.amountPaise} : {}),
    ...(parsed.note ? {note: parsed.note} : {}),
    ...(parsed.transactionReference ? {qrTransactionRef: parsed.transactionReference} : {}),
    ...(parsed.merchantCategoryCode ? {merchantCategoryCode: parsed.merchantCategoryCode} : {}),
    sanitizedUri: parsed.sanitizedUri,
  };
}

export const parseUpiQr = (value: string): MerchantData | null => {
  const parsed = parseValidatedUpiQr(value);
  if (!parsed.ok) {
    return null;
  }
  return merchantFromUpiQr(parsed);
};
