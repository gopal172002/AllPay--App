import type {OnboardingProfile} from '../types';
import {API_BASE, baseHeaders} from './apiConfig';

export type BackendEmployeeProfile = {
  name: string;
  email: string;
  department: string;
  employeeId: string | null;
  idAssigned?: boolean;
  phone: string | null;
  companyName: string;
};

type ApiError = {ok: false; message: string; needsOnboarding?: boolean};

async function parseJson<T>(res: Response): Promise<T & ApiError> {
  const raw = await res.text();
  return raw ? (JSON.parse(raw) as T & ApiError) : ({ok: false, message: 'Empty response'} as T & ApiError);
}

export function mapBackendProfile(p: BackendEmployeeProfile): OnboardingProfile {
  return {
    companyId: 'allpay',
    companyName: p.companyName || 'AllPay',
    employeeId: p.employeeId || '',
    employeeName: p.name,
    department: p.department,
    mobile: p.phone || '',
  };
}

export async function verifyInviteCode(inviteCode: string): Promise<
  | {
      ok: true;
      onboardingToken: string;
      alreadyOnboarded: boolean;
      profile: BackendEmployeeProfile;
      companyName: string;
    }
  | ApiError
> {
  try {
    const res = await fetch(`${API_BASE}/mobile/onboarding/verify-invite`, {
      method: 'POST',
      headers: baseHeaders(),
      body: JSON.stringify({inviteCode: inviteCode.trim()}),
    });
    const data = await parseJson<{
      ok: boolean;
      onboardingToken?: string;
      alreadyOnboarded?: boolean;
      profile?: BackendEmployeeProfile;
      companyName?: string;
      message?: string;
    }>(res);
    if (!res.ok || !data.ok || !data.onboardingToken || !data.profile) {
      return {ok: false, message: data.message || 'Invalid invite code'};
    }
    return {
      ok: true,
      onboardingToken: data.onboardingToken,
      alreadyOnboarded: Boolean(data.alreadyOnboarded),
      profile: data.profile,
      companyName: data.companyName || 'AllPay',
    };
  } catch {
    return {ok: false, message: 'Cannot reach server. Check backend is running and API URL.'};
  }
}

export async function loginWithInviteCode(inviteCode: string): Promise<
  | {ok: true; token: string; profile: BackendEmployeeProfile}
  | ApiError
> {
  try {
    const res = await fetch(`${API_BASE}/mobile/auth/login-invite`, {
      method: 'POST',
      headers: baseHeaders(),
      body: JSON.stringify({inviteCode: inviteCode.trim()}),
    });
    const data = await parseJson<{
      ok: boolean;
      token?: string;
      profile?: BackendEmployeeProfile;
      needsOnboarding?: boolean;
      message?: string;
    }>(res);
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        message: data.message || 'Login failed',
        needsOnboarding: data.needsOnboarding,
      };
    }
    if (!data.token || !data.profile) {
      return {ok: false, message: 'Invalid server response'};
    }
    return {ok: true, token: data.token, profile: data.profile};
  } catch {
    return {ok: false, message: 'Cannot reach server. Check backend is running.'};
  }
}

function onboardingHeaders(token: string): Record<string, string> {
  return {...baseHeaders(), Authorization: `Bearer ${token}`};
}

export async function confirmProfile(
  onboardingToken: string,
  phone: string,
  name?: string,
): Promise<{ok: true; profile: BackendEmployeeProfile} | ApiError> {
  try {
    const res = await fetch(`${API_BASE}/mobile/onboarding/confirm-profile`, {
      method: 'POST',
      headers: onboardingHeaders(onboardingToken),
      body: JSON.stringify({phone: phone.trim(), name: name?.trim()}),
    });
    const data = await parseJson<{ok: boolean; profile?: BackendEmployeeProfile; message?: string}>(res);
    if (!res.ok || !data.ok || !data.profile) {
      return {ok: false, message: data.message || 'Could not confirm profile'};
    }
    return {ok: true, profile: data.profile};
  } catch {
    return {ok: false, message: 'Network error confirming profile'};
  }
}

export async function sendOtp(onboardingToken: string): Promise<{ok: true; message: string} | ApiError> {
  try {
    const res = await fetch(`${API_BASE}/mobile/onboarding/send-otp`, {
      method: 'POST',
      headers: onboardingHeaders(onboardingToken),
    });
    const data = await parseJson<{ok: boolean; message?: string}>(res);
    if (!res.ok || !data.ok) {
      return {ok: false, message: data.message || 'Could not send OTP'};
    }
    return {ok: true, message: data.message || 'OTP sent'};
  } catch {
    return {ok: false, message: 'Network error sending OTP'};
  }
}

export async function verifyOtp(
  onboardingToken: string,
  otp: string,
): Promise<{ok: true} | ApiError> {
  try {
    const res = await fetch(`${API_BASE}/mobile/onboarding/verify-otp`, {
      method: 'POST',
      headers: onboardingHeaders(onboardingToken),
      body: JSON.stringify({otp: otp.trim()}),
    });
    const data = await parseJson<{ok: boolean; message?: string}>(res);
    if (!res.ok || !data.ok) {
      return {ok: false, message: data.message || 'Invalid OTP'};
    }
    return {ok: true};
  } catch {
    return {ok: false, message: 'Network error verifying OTP'};
  }
}

export async function completeOnboardingApi(
  onboardingToken: string,
): Promise<{ok: true; token: string; profile: BackendEmployeeProfile} | ApiError> {
  try {
    const res = await fetch(`${API_BASE}/mobile/onboarding/complete`, {
      method: 'POST',
      headers: onboardingHeaders(onboardingToken),
    });
    const data = await parseJson<{
      ok: boolean;
      token?: string;
      profile?: BackendEmployeeProfile;
      message?: string;
    }>(res);
    if (!res.ok || !data.ok || !data.token || !data.profile) {
      return {ok: false, message: data.message || 'Could not complete onboarding'};
    }
    return {ok: true, token: data.token, profile: data.profile};
  } catch {
    return {ok: false, message: 'Network error completing onboarding'};
  }
}
