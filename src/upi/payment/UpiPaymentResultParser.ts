import type {UpiIntentStatus, UpiPaymentResult} from '../model/types';

const STATUS_ALIASES: Record<string, string> = {
  success: 'SUCCESS',
  successful: 'SUCCESS',
  failure: 'FAILURE',
  failed: 'FAILURE',
  submitted: 'PENDING',
  pending: 'PENDING',
  submitted_to_bank: 'PENDING',
};

function decodePlus(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[_-]/g, '');
}

function pick(
  map: Record<string, string>,
  aliases: string[],
): string | null {
  for (const alias of aliases) {
    const value = map[normalizeKey(alias)];
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function parseQueryLike(raw: string): Record<string, string> {
  const map: Record<string, string> = {};
  const trimmed = raw.trim();
  if (!trimmed) {
    return map;
  }

  const normalized = trimmed
    .replace(/\r\n/g, '\n')
    .replace(/[;\n]/g, '&');

  const chunks = normalized.split('&');
  for (const chunk of chunks) {
    const eq = chunk.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = normalizeKey(decodePlus(chunk.slice(0, eq)));
    const value = decodePlus(chunk.slice(eq + 1)).trim();
    if (!key || map[key]) {
      continue;
    }
    map[key] = value;
  }
  return map;
}

function flattenNestedResponse(map: Record<string, string>): Record<string, string> {
  const nested = map.response || map.upiresponse || map.data;
  if (!nested || !nested.includes('=')) {
    return map;
  }
  return {...parseQueryLike(nested), ...map};
}

function normalizeReportedStatus(raw: string | null): string | null {
  if (!raw) {
    return null;
  }
  const key = raw.trim().toLowerCase();
  return STATUS_ALIASES[key] ?? raw.trim().toUpperCase();
}

function isSuccessResponseCode(code: string | null): boolean {
  if (!code) {
    return true;
  }
  const normalized = code.trim().toUpperCase();
  return normalized === '00' || normalized === '0' || normalized === 'SUCCESS';
}

/**
 * Defensive UPI Intent callback parser.
 * Field names and capitalization vary across GPay / PhonePe / Paytm / BHIM / banks.
 */
export function parseUpiPaymentResult(raw: string | null | undefined): UpiPaymentResult {
  const rawResponse = typeof raw === 'string' ? raw : '';
  if (!rawResponse.trim()) {
    return {
      status: null,
      transactionId: null,
      transactionReference: null,
      approvalReference: null,
      responseCode: null,
      rawResponse,
    };
  }

  const map = flattenNestedResponse(parseQueryLike(rawResponse));
  return {
    status: pick(map, ['status', 'txnstatus', 'paymentstatus']),
    transactionId: pick(map, ['txnid', 'transactionid', 'upiTxnId', 'banktxnid']),
    transactionReference: pick(map, ['txnref', 'transactionref', 'tr', 'txnreference']),
    approvalReference: pick(map, ['approvalrefno', 'approvalref', 'approvalreferenceno']),
    responseCode: pick(map, ['responsecode', 'respcode', 'statuscode']),
    rawResponse: rawResponse.slice(0, 400),
  };
}

export function mapUpiResultToStatus(
  result: UpiPaymentResult,
  expectedTxnRef?: string,
): UpiIntentStatus {
  const status = normalizeReportedStatus(result.status);
  if (!status) {
    return 'UNKNOWN';
  }
  if (status === 'FAILURE') {
    return 'FAILED';
  }
  if (status === 'PENDING') {
    return 'PENDING';
  }
  if (status === 'SUCCESS') {
    const hasRef = Boolean(
      result.transactionId || result.transactionReference || result.approvalReference,
    );
    if (!hasRef) {
      return 'UNKNOWN';
    }
    if (
      expectedTxnRef &&
      result.transactionReference &&
      result.transactionReference.toUpperCase() !== expectedTxnRef.toUpperCase()
    ) {
      return 'UNKNOWN';
    }
    if (!isSuccessResponseCode(result.responseCode)) {
      return 'FAILED';
    }
    return 'SUCCESS_REPORTED';
  }
  return 'UNKNOWN';
}
