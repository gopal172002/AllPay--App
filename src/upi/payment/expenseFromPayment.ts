import type {Transaction} from '../../types';
import {paiseToRupeeLabel} from '../money';
import type {UpiIntentPayment} from '../model/types';

export function expenseIdForPayment(paymentId: string): string {
  return `TXN-${paymentId.replace(/-/g, '').slice(0, 12).toUpperCase()}`;
}

export function expenseFromPayment(
  payment: UpiIntentPayment,
  employeeId: string,
  expenseId?: string,
): Transaction {
  const amountLabel = paiseToRupeeLabel(payment.amountPaise);
  return {
    id: expenseId ?? payment.expenseId ?? expenseIdForPayment(payment.id),
    employeeId,
    merchant: {
      vpa: payment.payeeVpa,
      name: payment.payeeName,
      category: payment.category,
      mcc: payment.mcc,
      amountPaise: payment.amountPaise,
      amount: Number(amountLabel),
      note: payment.note,
    },
    amount: Number(amountLabel),
    amountPaise: payment.amountPaise,
    timestamp: payment.completedAt ?? payment.returnedAt ?? payment.initiatedAt,
    upiApp: 'UPI',
    upiRefId: payment.upiTxnId ?? payment.upiTxnRef,
    status: 'Recorded',
    syncStatus: 'queued',
    receipts: [],
    location: null,
    paymentStatus: payment.status,
    paymentMethod: 'UPI_INTENT',
    paymentId: payment.id,
    upiTxnRef: payment.upiTxnRef,
    approvalRefNo: payment.approvalRefNo,
    upiResponseCode: payment.upiResponseCode,
    expenseSource: 'EXPENZO_UPI_INTENT',
    paymentConfirmedAt: payment.completedAt ?? payment.returnedAt,
  };
}
