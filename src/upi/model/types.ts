/**
 * UPI Intent tracking types.
 *
 * Trust model: Expenzo only records what an external UPI app reported via
 * Android Activity Result. SUCCESS_REPORTED is not bank/NPCI settlement
 * verification. Expenzo is not a PSP, TPAP, wallet, or payment gateway.
 */

export const UPI_INTENT_STATUSES = [
  'INITIATED',
  'UPI_APP_OPENED',
  'SUCCESS_REPORTED',
  'FAILED',
  'PENDING',
  'UNKNOWN',
  'CANCELLED',
  'USER_CONFIRMED',
] as const;

export type UpiIntentStatus = (typeof UPI_INTENT_STATUSES)[number];

export const UPI_TERMINAL_STATUSES: ReadonlySet<UpiIntentStatus> = new Set([
  'SUCCESS_REPORTED',
  'FAILED',
  'CANCELLED',
  'USER_CONFIRMED',
]);

export const UPI_UNRESOLVED_STATUSES: ReadonlySet<UpiIntentStatus> = new Set([
  'INITIATED',
  'UPI_APP_OPENED',
]);

export type UpiQrParseOk = {
  ok: true;
  scheme: 'upi';
  action: 'pay';
  payeeVpa: string;
  payeeName: string;
  amountPaise?: number;
  currency: 'INR';
  note?: string;
  transactionReference?: string;
  merchantCategoryCode?: string;
  category: string;
  /** Sanitized upi://pay?... URI built from accepted params only. */
  sanitizedUri: string;
};

export type UpiQrParseError = {
  ok: false;
  code:
    | 'UNSUPPORTED_SCHEME'
    | 'NOT_UPI_PAY'
    | 'MISSING_VPA'
    | 'INVALID_VPA'
    | 'INVALID_AMOUNT'
    | 'INVALID_CURRENCY'
    | 'LIMIT_EXCEEDED'
    | 'MALFORMED'
    | 'PARAM_TOO_LONG';
  message: string;
};

export type UpiQrParseResult = UpiQrParseOk | UpiQrParseError;

export type UpiPaymentResult = {
  status: string | null;
  transactionId: string | null;
  transactionReference: string | null;
  approvalReference: string | null;
  responseCode: string | null;
  rawResponse: string;
};

export type UpiIntentPayment = {
  id: string;
  userId: string;
  amountPaise: number;
  currency: 'INR';
  payeeName: string;
  payeeVpa: string;
  note?: string;
  category: string;
  mcc: string;
  paymentMethod: 'UPI_INTENT';
  status: UpiIntentStatus;
  upiTxnId?: string;
  upiTxnRef?: string;
  approvalRefNo?: string;
  upiResponseCode?: string;
  initiatedAt: string;
  returnedAt?: string;
  completedAt?: string;
  expenseId?: string;
  /** Short ref sent as UPI `tr` for correlation. */
  launchTxnRef: string;
};

export type UpiExpenseLink = {
  paymentId: string;
  expenseId: string;
};
