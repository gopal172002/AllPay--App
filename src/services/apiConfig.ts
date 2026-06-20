import {Platform} from 'react-native';

/**
 * AllPay-Dashboard backend base URL (includes `/api`).
 * - Android emulator: 10.0.2.2 → host machine
 * - Physical device: set to your PC LAN IP, e.g. http://192.168.1.5:5000/api
 */
export const API_BASE = Platform.select({
  android: 'http://10.0.2.2:5000/api',
  ios: 'http://localhost:5000/api',
  default: 'http://localhost:5000/api',
}) as string;

export const MOBILE_SYNC_SECRET = '';

export function baseHeaders(): Record<string, string> {
  const h: Record<string, string> = {'Content-Type': 'application/json'};
  if (MOBILE_SYNC_SECRET) {
    h['X-AllPay-Sync-Secret'] = MOBILE_SYNC_SECRET;
  }
  return h;
}
