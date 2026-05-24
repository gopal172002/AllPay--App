import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform} from 'react-native';

const AUTH_TOKEN_KEY = 'allpay.employee.jwt';
const AUTH_EMPLOYEE_KEY = 'allpay.employee.id';

const API_BASE = Platform.select({
  android: 'http://10.0.2.2:5000/api',
  ios: 'http://localhost:5000/api',
  default: 'http://localhost:5000/api',
});

const MOBILE_SYNC_SECRET = '';

function baseHeaders(): Record<string, string> {
  const h: Record<string, string> = {'Content-Type': 'application/json'};
  if (MOBILE_SYNC_SECRET) {
    h['X-AllPay-Sync-Secret'] = MOBILE_SYNC_SECRET;
  }
  return h;
}

export async function getEmployeeAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}

export async function clearEmployeeAuth(): Promise<void> {
  await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_EMPLOYEE_KEY]);
}

export async function authenticateEmployee(
  employeeId: string,
  inviteToken: string,
): Promise<{ok: boolean; token?: string}> {
  try {
    const res = await fetch(`${API_BASE}/mobile/auth/employee-token`, {
      method: 'POST',
      headers: baseHeaders(),
      body: JSON.stringify({employeeId, inviteToken}),
    });
    const data = (await res.json()) as {ok?: boolean; token?: string};
    if (!res.ok || !data.ok || !data.token) {
      return {ok: false};
    }
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, data.token);
    await AsyncStorage.setItem(AUTH_EMPLOYEE_KEY, employeeId);
    return {ok: true, token: data.token};
  } catch {
    return {ok: false};
  }
}

export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getEmployeeAuthToken();
  const headers = baseHeaders();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export {API_BASE};
