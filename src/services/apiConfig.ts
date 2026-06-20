import {Platform} from 'react-native';
import {API_BASE_URL, MOBILE_SYNC_SECRET, USE_LOCAL_API} from '@env';

function normalizeApiBase(raw: string | undefined): string {
  const base = String(raw ?? '').trim().replace(/\/$/, '');
  if (!base) {
    return 'https://allpay-dashboard.onrender.com/api';
  }
  if (/^https?:\/\/[^/?#]+(?::\d+)?$/i.test(base)) {
    return `${base}/api`;
  }
  return base;
}

/**
 * Local backend for development.
 * Android emulator: 10.0.2.2 → host machine localhost
 */
const LOCAL_API_BASE = Platform.select({
  android: 'http://10.0.2.2:5000/api',
  ios: 'http://localhost:5000/api',
  default: 'http://localhost:5000/api',
}) as string;

const useLocalApi =
  String(USE_LOCAL_API ?? '').toLowerCase() === 'true' ||
  USE_LOCAL_API === '1';

export const API_BASE = useLocalApi
  ? LOCAL_API_BASE
  : normalizeApiBase(API_BASE_URL);

export const MOBILE_SYNC_SECRET_VALUE = MOBILE_SYNC_SECRET ?? '';

export function baseHeaders(): Record<string, string> {
  const h: Record<string, string> = {'Content-Type': 'application/json'};
  if (MOBILE_SYNC_SECRET_VALUE) {
    h['X-AllPay-Sync-Secret'] = MOBILE_SYNC_SECRET_VALUE;
  }
  return h;
}
