import {Linking, NativeModules, Platform} from 'react-native';
import {KNOWN_UPI_APPS} from '../../constants/mockData';
import {detectInstalledUpiApps} from '../../services/upiApps';

type NativePayResult = {
  cancelled?: boolean;
  noApp?: boolean;
  unsupported?: boolean;
  resultCode?: number;
  raw?: string;
};

type UpiIntentNative = {
  pay: (upiUri: string, packageName?: string | null) => Promise<NativePayResult>;
  hasCompatibleApp: (upiUri: string) => Promise<boolean>;
};

const native = NativeModules.UpiIntentModule as UpiIntentNative | undefined;

/** Preferred payment apps — never open bare upi:// first (WhatsApp steals it on iOS). */
const IOS_UPI_APP_ORDER = ['paytm', 'phonepe', 'gpay', 'bhim'] as const;

/**
 * Official PSP deep-link prefixes (Juspay / NPCI iOS package list).
 * Paytm MUST be paytmmp://upi/pay — paytmmp://pay is a different (non-UPI) path
 * that often fails after PIN with "UPI risk policy".
 */
const IOS_SCHEME_PREFIX: Record<(typeof IOS_UPI_APP_ORDER)[number], string[]> = {
  paytm: ['paytmmp://upi/pay', 'paytm://upi/pay'],
  phonepe: ['phonepe://pay', 'phonepe://upi/pay'],
  gpay: ['gpay://upi/pay', 'tez://upi/pay'],
  bhim: ['bhim://upi/pay', 'bhim://upi://pay'],
};

const ANDROID_PACKAGE: Record<string, string> = {
  paytm: 'net.one97.paytm',
  phonepe: 'com.phonepe.app',
  gpay: 'com.google.android.apps.nbu.paisa.user',
  bhim: 'in.org.npci.upiapp',
};

export type UpiLaunchResult =
  | {kind: 'callback'; raw: string}
  | {kind: 'opened'}
  | {kind: 'cancelled'}
  | {kind: 'no_app'}
  | {kind: 'unsupported'};

export type UpiLaunchOptions = {
  /** Preferred app id: paytm | phonepe | gpay | bhim */
  preferredAppId?: string | null;
};

function assertSafeUpiUri(upiUri: string): void {
  if (!upiUri.toLowerCase().startsWith('upi://pay?')) {
    throw new Error('Refusing to launch a non-UPI payment URI');
  }
}

function queryFromUpiUri(upiUri: string): string {
  const q = upiUri.indexOf('?');
  return q >= 0 ? upiUri.slice(q + 1) : '';
}

function buildAppPayUri(schemePrefix: string, query: string): string {
  const joiner = schemePrefix.includes('?') ? '&' : '?';
  return `${schemePrefix}${joiner}${query}`;
}

async function canOpenScheme(url: string): Promise<boolean> {
  try {
    return await Linking.canOpenURL(url);
  } catch {
    return false;
  }
}

/**
 * Detect installed payment UPI apps on iOS (excludes WhatsApp / generic upi://).
 */
export async function detectIosPaymentUpiApps(): Promise<
  Array<{id: string; name: string}>
> {
  const found: Array<{id: string; name: string}> = [];
  for (const id of IOS_UPI_APP_ORDER) {
    const prefixes = IOS_SCHEME_PREFIX[id];
    let ok = false;
    for (const prefix of prefixes) {
      if (await canOpenScheme(prefix)) {
        ok = true;
        break;
      }
    }
    if (ok) {
      const known = KNOWN_UPI_APPS.find(app => app.id === id);
      found.push({id, name: known?.name ?? id});
    }
  }
  return found;
}

async function hasCompatibleUpiAppIos(): Promise<boolean> {
  const apps = await detectIosPaymentUpiApps();
  if (apps.length > 0) {
    return true;
  }
  try {
    const apps = await detectInstalledUpiApps();
    return apps.some(app =>
      IOS_UPI_APP_ORDER.includes(app.id as (typeof IOS_UPI_APP_ORDER)[number]),
    );
  } catch {
    return false;
  }
}

async function launchUpiIntentIos(
  upiUri: string,
  options?: UpiLaunchOptions,
): Promise<UpiLaunchResult> {
  const query = queryFromUpiUri(upiUri);
  if (!query) {
    return {kind: 'unsupported'};
  }

  const installed = await detectIosPaymentUpiApps();
  if (installed.length === 0) {
    return {kind: 'no_app'};
  }

  const preferred = options?.preferredAppId?.toLowerCase() ?? null;
  const orderedIds = [
    ...(preferred &&
    IOS_UPI_APP_ORDER.includes(preferred as (typeof IOS_UPI_APP_ORDER)[number])
      ? [preferred]
      : []),
    ...IOS_UPI_APP_ORDER.filter(id => id !== preferred),
  ].filter(id => installed.some(app => app.id === id));

  for (const id of orderedIds) {
    const prefixes = IOS_SCHEME_PREFIX[id as (typeof IOS_UPI_APP_ORDER)[number]];
    for (const prefix of prefixes) {
      if (!(await canOpenScheme(prefix))) {
        continue;
      }
      const target = buildAppPayUri(prefix, query);
      try {
        await Linking.openURL(target);
        return {kind: 'opened'};
      } catch {
        // try next scheme / app
      }
    }
  }

  return {kind: 'no_app'};
}

export async function hasCompatibleUpiApp(upiUri: string): Promise<boolean> {
  assertSafeUpiUri(upiUri);
  if (Platform.OS === 'ios') {
    return hasCompatibleUpiAppIos();
  }
  if (Platform.OS !== 'android' || !native?.hasCompatibleApp) {
    return false;
  }
  try {
    return await native.hasCompatibleApp(upiUri);
  } catch {
    return false;
  }
}

/**
 * Opens a UPI payment app with a standard upi://pay?... request.
 * - Android: ACTION_VIEW (optionally package-targeted) + Activity Result
 * - iOS: PSP deep links (Paytm = paytmmp://upi/pay) — never WhatsApp
 */
export async function launchUpiIntent(
  upiUri: string,
  options?: UpiLaunchOptions,
): Promise<UpiLaunchResult> {
  assertSafeUpiUri(upiUri);
  if (Platform.OS === 'ios') {
    return launchUpiIntentIos(upiUri, options);
  }
  if (Platform.OS !== 'android' || !native?.pay) {
    return {kind: 'unsupported'};
  }
  const preferred = options?.preferredAppId?.toLowerCase() ?? null;
  const packageName = preferred ? ANDROID_PACKAGE[preferred] ?? null : null;
  try {
    const result = await native.pay(upiUri, packageName);
    if (result.unsupported) {
      return {kind: 'unsupported'};
    }
    if (result.noApp) {
      return {kind: 'no_app'};
    }
    if (result.cancelled) {
      return {kind: 'cancelled'};
    }
    return {kind: 'callback', raw: result.raw ?? ''};
  } catch {
    return {kind: 'callback', raw: ''};
  }
}
