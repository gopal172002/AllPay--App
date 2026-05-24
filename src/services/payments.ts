import type {MerchantData, PaymentStatus, Transaction} from '../types';
import {API_BASE, authHeaders} from './auth';

export type CreateOrderResponse = {
  ok: boolean;
  orderId?: string;
  amount?: number;
  currency?: string;
  keyId?: string;
  txId?: string;
  message?: string;
};

export type ConfirmPaymentPayload = {
  txId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type PaymentStatusResponse = {
  ok: boolean;
  paymentStatus?: PaymentStatus;
  razorpayPaymentId?: string | null;
  razorpayOrderId?: string | null;
  expenseStatus?: string;
  message?: string;
};

/** When true, PaymentScreen uses Razorpay instead of simulated UPI callback. */
export const USE_RAZORPAY_UPI = true;

export async function createPaymentOrder(input: {
  txId: string;
  amount: number;
  employeeId: string;
  merchant: MerchantData;
  upiApp?: string;
  employeeName?: string;
  department?: string;
}): Promise<CreateOrderResponse> {
  try {
    const res = await fetch(`${API_BASE}/mobile/payments/create-order`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(input),
    });
    const data = (await res.json()) as CreateOrderResponse;
    if (!res.ok) {
      return {ok: false, message: data.message ?? 'Failed to create payment order'};
    }
    return data;
  } catch {
    return {ok: false, message: 'Network error creating payment order'};
  }
}

export async function confirmPaymentOnBackend(
  payload: ConfirmPaymentPayload,
): Promise<{ok: boolean; paymentStatus?: PaymentStatus; message?: string}> {
  try {
    const res = await fetch(`${API_BASE}/mobile/payments/confirm`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      paymentStatus?: PaymentStatus;
      message?: string;
    };
    if (!res.ok) {
      return {ok: false, message: data.message ?? 'Payment confirmation failed'};
    }
    return {ok: true, paymentStatus: data.paymentStatus};
  } catch {
    return {ok: false, message: 'Network error confirming payment'};
  }
}

export async function markCheckoutOpened(txId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/mobile/payments/checkout-opened`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({txId}),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function pollPaymentStatus(txId: string): Promise<PaymentStatusResponse> {
  try {
    const res = await fetch(
      `${API_BASE}/mobile/transactions/${encodeURIComponent(txId)}/payment-status`,
      {headers: await authHeaders()},
    );
    const data = (await res.json()) as PaymentStatusResponse;
    if (!res.ok) {
      return {ok: false, message: data.message ?? 'Failed to fetch payment status'};
    }
    return data;
  } catch {
    return {ok: false, message: 'Network error fetching payment status'};
  }
}

export function mapPaymentStatusToTransactionStatus(
  paymentStatus: PaymentStatus | undefined,
): Transaction['status'] {
  switch (paymentStatus) {
    case 'payment_captured':
    case 'legacy_simulated':
      return 'Recorded';
    case 'payment_failed':
    case 'payment_abandoned':
      return 'Abandoned';
    case 'payment_processing':
    case 'checkout_opened':
    case 'order_created':
      return 'Recorded';
    default:
      return 'Recorded';
  }
}

export function isTerminalPaymentStatus(status: PaymentStatus | undefined): boolean {
  return (
    status === 'payment_captured' ||
    status === 'payment_failed' ||
    status === 'payment_abandoned' ||
    status === 'legacy_simulated'
  );
}

export function isPaymentCaptured(status: PaymentStatus | undefined): boolean {
  return status === 'payment_captured' || status === 'legacy_simulated';
}
