import {isSaneAmountPaise, parseAmountParamToPaise} from '../money';
import type {UpiQrParseResult} from '../model/types';

const MAX_NAME = 100;
const MAX_NOTE = 80;
const MAX_TR = 35;
const MAX_VPA = 255;
const MAX_URI = 4096;

const BLOCKED_SCHEMES = new Set([
  'http',
  'https',
  'javascript',
  'file',
  'data',
  'content',
  'package',
  'market',
]);

const VPA_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;

/** Strip chat noise / invisible chars WhatsApp and keyboards often inject. */
function normalizeRawPayload(raw: string): string {
  let value = String(raw ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/[\u00A0\u202F]/g, ' ')
    .replace(/[＠]/g, '@')
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim();

  if (/^(?:upi:|intent:)/i.test(value)) {
    return value.replace(/[.,;)\]]+$/g, '');
  }

  // WhatsApp / chat line with surrounding text before the UPI URI.
  const embeddedUpi = value.match(
    /(?:upi:\/\/pay\?[^\n\r"'<>]+|intent:\/\/pay\?[^\n\r"'<>]+)/i,
  );
  if (embeddedUpi?.[0]) {
    return embeddedUpi[0].replace(/[.,;)\]]+$/g, '');
  }

  return value;
}

function inferCategory(note: string | undefined, mcc: string | undefined): string {
  const hay = `${note ?? ''} ${mcc ?? ''}`.toLowerCase();
  if (hay.includes('fuel') || mcc === '5541') {
    return 'fuel';
  }
  if (hay.includes('travel') || mcc === '4111') {
    return 'travel';
  }
  if (hay.includes('food') || hay.includes('meal') || mcc === '5812') {
    return 'food';
  }
  if (hay.includes('grocery') || mcc === '5411') {
    return 'groceries';
  }
  return 'office';
}

function decodeQueryValue(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch {
    return raw.replace(/\+/g, ' ');
  }
}

function parseQuery(query: string): Record<string, string> {
  const out: Record<string, string> = {};
  const trimmed = query.replace(/^\?/, '').split('#')[0];
  if (!trimmed) {
    return out;
  }
  for (const part of trimmed.split('&')) {
    if (!part) {
      continue;
    }
    const eq = part.indexOf('=');
    const key = decodeQueryValue(eq >= 0 ? part.slice(0, eq) : part)
      .trim()
      .toLowerCase();
    const value = decodeQueryValue(eq >= 0 ? part.slice(eq + 1) : '').trim();
    if (key && out[key] === undefined) {
      out[key] = value;
    }
  }
  return out;
}

function buildSanitizedUri(params: Record<string, string>): string {
  const search = new URLSearchParams();
  for (const key of ['pa', 'pn', 'am', 'cu', 'tn', 'tr', 'mc']) {
    if (params[key]) {
      search.set(key, params[key]);
    }
  }
  return `upi://pay?${search.toString()}`;
}

function resultFromParams(params: Record<string, string>): UpiQrParseResult {
  const pa = (params.pa ?? '').trim();
  const pn = (params.pn ?? '').trim();
  const am = (params.am ?? '').trim();
  const cu = (params.cu ?? '').trim();
  const tn = (params.tn ?? '').trim();
  const tr = (params.tr ?? '').trim();
  const mc = (params.mc ?? '').trim();

  if (!pa) {
    return {ok: false, code: 'MISSING_VPA', message: 'Payee UPI ID is missing.'};
  }
  if (pa.length > MAX_VPA || !VPA_PATTERN.test(pa)) {
    return {ok: false, code: 'INVALID_VPA', message: 'Payee UPI ID is not valid.'};
  }
  if (pn.length > MAX_NAME || tn.length > MAX_NOTE || tr.length > MAX_TR) {
    return {ok: false, code: 'PARAM_TOO_LONG', message: 'A QR field exceeds the allowed length.'};
  }
  if (cu && cu.toUpperCase() !== 'INR' && cu !== '356') {
    return {ok: false, code: 'INVALID_CURRENCY', message: 'Only INR payments are supported.'};
  }

  let amountPaise: number | undefined;
  if (am) {
    const parsed = parseAmountParamToPaise(am);
    if (parsed === null || parsed <= 0) {
      return {ok: false, code: 'INVALID_AMOUNT', message: 'Amount on the QR is invalid.'};
    }
    if (!isSaneAmountPaise(parsed)) {
      return {ok: false, code: 'LIMIT_EXCEEDED', message: 'Amount is outside allowed limits.'};
    }
    amountPaise = parsed;
  }

  const category = inferCategory(tn || undefined, mc || undefined);
  const sanitized: Record<string, string> = {
    pa,
    pn: pn || 'Unknown payee',
    cu: 'INR',
  };
  if (am) {
    sanitized.am = am;
  }
  if (tn) {
    sanitized.tn = tn;
  }
  if (tr) {
    sanitized.tr = tr;
  }
  if (mc && mc !== '0000') {
    sanitized.mc = mc;
  }

  return {
    ok: true,
    scheme: 'upi',
    action: 'pay',
    payeeVpa: pa,
    payeeName: pn || 'Unknown payee',
    ...(amountPaise !== undefined ? {amountPaise} : {}),
    currency: 'INR',
    ...(tn ? {note: tn} : {}),
    ...(tr ? {transactionReference: tr} : {}),
    ...(mc && mc !== '0000' ? {merchantCategoryCode: mc} : {}),
    category,
    sanitizedUri: buildSanitizedUri(sanitized),
  };
}

function parseEmvTlv(payload: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i + 4 <= payload.length) {
    const id = payload.slice(i, i + 2);
    const len = Number.parseInt(payload.slice(i + 2, i + 4), 10);
    if (!Number.isFinite(len) || len < 0 || i + 4 + len > payload.length) {
      break;
    }
    out[id] = payload.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return out;
}

function parseBharatQr(raw: string): UpiQrParseResult {
  const payload = raw.trim();
  const root = parseEmvTlv(payload);
  const params: Record<string, string> = {};
  const name = (root['59'] ?? '').trim();
  const amount = (root['54'] ?? '').trim();
  const mcc = (root['52'] ?? '').trim();
  const currency = (root['53'] ?? '').trim();
  if (name) {
    params.pn = name;
  }
  if (amount) {
    params.am = amount;
  }
  if (mcc) {
    params.mc = mcc;
  }
  if (currency === '356') {
    params.cu = 'INR';
  } else if (currency) {
    params.cu = currency;
  }

  for (let tag = 26; tag <= 51; tag += 1) {
    const nestedRaw = root[String(tag)];
    if (!nestedRaw) {
      continue;
    }
    const nested = parseEmvTlv(nestedRaw);
    const gui = (nested['00'] ?? '').toLowerCase();
    const candidate = (nested['01'] ?? nested['02'] ?? '').trim();
    const looksUpi =
      gui.includes('upi') ||
      gui.includes('npci') ||
      gui.includes('a000000722') ||
      VPA_PATTERN.test(candidate);
    if (looksUpi && VPA_PATTERN.test(candidate)) {
      params.pa = candidate;
      break;
    }
    if (!params.pa && VPA_PATTERN.test(candidate)) {
      params.pa = candidate;
    }
  }

  return resultFromParams(params);
}

function unwrapIntentUpi(value: string): string | null {
  if (!/^intent:/i.test(value)) {
    return null;
  }
  if (!/[;,]scheme=upi(?:;|$)/i.test(value) && !/scheme=upi/i.test(value)) {
    return null;
  }
  const hash = value.indexOf('#');
  const body = value.slice('intent:'.length, hash >= 0 ? hash : undefined);
  if (!body) {
    return null;
  }
  return `upi:${body.startsWith('//') ? body : `//${body}`}`;
}

/**
 * Split `upi://pay?...` without `new URL()`.
 * RN/Hermes often parses `upi://pay?pa=user@bank` as host=`bank` or path=`//pay`.
 */
function splitUpiUri(value: string): {action: string; query: string} | null {
  if (!/^upi:/i.test(value)) {
    return null;
  }
  let rest = value.slice(value.indexOf(':') + 1);
  rest = rest.replace(/^\/\//, '').replace(/^\//, '');
  const queryIndex = rest.indexOf('?');
  const beforeQuery = (queryIndex >= 0 ? rest.slice(0, queryIndex) : rest).toLowerCase();
  const action = beforeQuery.split('/')[0].split('#')[0];
  const query = queryIndex >= 0 ? rest.slice(queryIndex + 1) : '';
  return {action, query};
}

/**
 * Parses and validates a UPI payment QR payload.
 * Never pass the raw scan string to Android intents — use sanitizedUri.
 */
export function parseUpiQr(raw: string): UpiQrParseResult {
  const value = normalizeRawPayload(raw);
  if (!value || value.length > MAX_URI) {
    return {ok: false, code: 'MALFORMED', message: 'QR payload is empty or too long.'};
  }

  if (VPA_PATTERN.test(value)) {
    return resultFromParams({pa: value, pn: value.split('@')[0]});
  }

  if (/^0002\d{2}/.test(value) && value.length >= 20) {
    return parseBharatQr(value);
  }

  const unwrapped = unwrapIntentUpi(value);
  const upiValue = unwrapped ?? value;

  const schemeMatch = upiValue.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  const scheme = schemeMatch?.[1]?.toLowerCase() ?? '';
  if (!scheme) {
    return {ok: false, code: 'MALFORMED', message: 'QR is not a URI.'};
  }
  if (BLOCKED_SCHEMES.has(scheme) || scheme !== 'upi') {
    return {
      ok: false,
      code: 'UNSUPPORTED_SCHEME',
      message: 'Only UPI payment QR codes are accepted.',
    };
  }

  const split = splitUpiUri(upiValue);
  if (!split) {
    return {ok: false, code: 'MALFORMED', message: 'QR URI could not be parsed.'};
  }
  if (split.action !== 'pay') {
    return {
      ok: false,
      code: 'NOT_UPI_PAY',
      message: 'This UPI QR is not a payment request.',
    };
  }

  return resultFromParams(parseQuery(split.query));
}

export function buildUpiPayUri(input: {
  payeeVpa: string;
  payeeName: string;
  amountPaise: number;
  note?: string;
  /** Only the QR's own `tr` for registered merchants — never app-generated refs. */
  merchantTransactionRef?: string;
  /** Only when the scanned QR included `mc`. */
  merchantCategoryCode?: string;
}): string {
  const rupees = Math.floor(input.amountPaise / 100);
  const paise = input.amountPaise % 100;
  const am = `${rupees}.${String(paise).padStart(2, '0')}`;
  const search = new URLSearchParams({
    pa: input.payeeVpa.trim(),
    pn: input.payeeName.trim().slice(0, MAX_NAME),
    am,
    cu: 'INR',
  });
  if (input.note?.trim()) {
    search.set('tn', input.note.trim().slice(0, MAX_NOTE));
  }
  const qrTr = input.merchantTransactionRef?.trim();
  if (qrTr) {
    search.set('tr', qrTr.slice(0, MAX_TR));
  }
  const qrMc = input.merchantCategoryCode?.trim();
  if (qrMc && qrMc !== '0000') {
    search.set('mc', qrMc.slice(0, 4));
  }
  return `upi://pay?${search.toString()}`;
}
