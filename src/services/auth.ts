import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_BASE, baseHeaders, MOBILE_SYNC_SECRET} from './apiConfig';

const AUTH_TOKEN_KEY = 'allpay.employee.jwt';
const AUTH_EMPLOYEE_KEY = 'allpay.employee.id';

export async function getEmployeeAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}

export async function saveEmployeeAuth(token: string, employeeId: string): Promise<void> {
  await AsyncStorage.multiSet([
    [AUTH_TOKEN_KEY, token],
    [AUTH_EMPLOYEE_KEY, employeeId],
  ]);
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
    await saveEmployeeAuth(data.token, employeeId);
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
  } else if (MOBILE_SYNC_SECRET) {
    headers['X-AllPay-Sync-Secret'] = MOBILE_SYNC_SECRET;
  }
  return headers;
}

export {API_BASE};
