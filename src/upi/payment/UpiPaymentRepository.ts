import {authHeaders} from '../../services/auth';
import {API_BASE} from '../../services/apiConfig';
import type {UpiIntentPayment, UpiIntentStatus} from '../model/types';

export type CreatePaymentBody = {
  paymentId: string;
  employeeId: string;
  amountPaise: number;
  currency: 'INR';
  payeeVpa: string;
  payeeName: string;
  note?: string;
  category?: string;
  mcc?: string;
  paymentMethod: 'UPI_INTENT';
  launchTxnRef: string;
};

export type ResultBody = {
  status: UpiIntentStatus;
  employeeId: string;
  upiTxnId?: string;
  upiTxnRef?: string;
  approvalRefNo?: string;
  responseCode?: string;
};

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function toCreatePaymentBody(
  payment: UpiIntentPayment,
  employeeId: string,
): CreatePaymentBody {
  return {
    paymentId: payment.id,
    employeeId,
    amountPaise: payment.amountPaise,
    currency: 'INR',
    payeeVpa: payment.payeeVpa,
    payeeName: payment.payeeName,
    note: payment.note,
    category: payment.category,
    mcc: payment.mcc,
    paymentMethod: 'UPI_INTENT',
    launchTxnRef: payment.launchTxnRef,
  };
}

export async function createUpiPaymentRemote(
  body: CreatePaymentBody,
): Promise<{ok: boolean; paymentId?: string; message?: string}> {
  try {
    const res = await fetch(`${API_BASE}/v1/payments`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(body),
    });
    const data = await parseJson(res);
    if (!res.ok) {
      return {ok: false, message: String(data.message ?? 'Could not create payment')};
    }
    return {ok: true, paymentId: String(data.paymentId ?? body.paymentId)};
  } catch {
    return {ok: false, message: 'Network error creating payment'};
  }
}

export async function submitUpiPaymentResultRemote(
  paymentId: string,
  body: ResultBody,
): Promise<{ok: boolean; expenseId?: string; status?: UpiIntentStatus; message?: string}> {
  try {
    const res = await fetch(
      `${API_BASE}/v1/payments/${encodeURIComponent(paymentId)}/result`,
      {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(body),
      },
    );
    const data = await parseJson(res);
    if (!res.ok) {
      return {ok: false, message: String(data.message ?? 'Could not store payment result')};
    }
    return {
      ok: true,
      expenseId: typeof data.expenseId === 'string' ? data.expenseId : undefined,
      status: data.status as UpiIntentStatus | undefined,
    };
  } catch {
    return {ok: false, message: 'Network error storing payment result'};
  }
}

export async function syncUpiPaymentResult(
  payment: UpiIntentPayment,
  employeeId: string,
): Promise<{ok: boolean; expenseId?: string; status?: UpiIntentStatus}> {
  const resultBody: ResultBody = {
    status: payment.status,
    employeeId,
    upiTxnId: payment.upiTxnId,
    upiTxnRef: payment.upiTxnRef,
    approvalRefNo: payment.approvalRefNo,
    responseCode: payment.upiResponseCode,
  };
  let remote = await submitUpiPaymentResultRemote(payment.id, resultBody);
  if (remote.ok) {
    return remote;
  }
  const created = await createUpiPaymentRemote(toCreatePaymentBody(payment, employeeId));
  if (!created.ok) {
    return remote;
  }
  remote = await submitUpiPaymentResultRemote(payment.id, resultBody);
  return remote;
}
