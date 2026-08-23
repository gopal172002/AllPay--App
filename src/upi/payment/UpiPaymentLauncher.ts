import {Linking, NativeModules, Platform} from 'react-native';
import {detectInstalledUpiApps} from '../../services/upiApps';

type NativePayResult = {
  cancelled?: boolean;
  noApp?: boolean;
  unsupported?: boolean;
  resultCode?: number;
  raw?: string;
};

type UpiIntentNative = {
  pay: (upiUri: string) => Promise<NativePayResult>;
  hasCompatibleApp: (upiUri: string) => Promise<boolean>;
};

const native = NativeModules.UpiIntentModule as UpiIntentNative | undefined;

export type UpiLaunchResult =
  | {kind: 'callback'; raw: string}
  | {kind: 'opened'}
  | {kind: 'cancelled'}
  | {kind: 'no_app'}
  | {kind: 'unsupported'};

function assertSafeUpiUri(upiUri: string): void {
  if (!upiUri.toLowerCase().startsWith('upi://pay?')) {
    throw new Error('Refusing to launch a non-UPI payment URI');
  }
}

async function hasCompatibleUpiAppIos(): Promise<boolean> {
  try {
    if (await Linking.canOpenURL('upi://pay')) {
      return true;
    }
  } catch {
    // continue to installed-app probe
  }
  try {
    const apps = await detectInstalledUpiApps();
    return apps.length > 0;
  } catch {
    return false;
  }
}

/**
 * Opens a UPI payment URI on iOS. There is no Activity Result callback —
 * the caller should leave the payment as UPI_APP_OPENED / UNKNOWN and let
 * the user confirm with USER_CONFIRMED after returning from the UPI app.
 */
async function launchUpiIntentIos(upiUri: string): Promise<UpiLaunchResult> {
  try {
    const canOpen = await Linking.canOpenURL(upiUri);
    if (!canOpen) {
      const apps = await detectInstalledUpiApps();
      if (apps.length === 0) {
        return {kind: 'no_app'};
      }
    }
    await Linking.openURL(upiUri);
    return {kind: 'opened'};
  } catch {
    return {kind: 'no_app'};
  }
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
 * Opens a UPI payment app.
 * - Android: ACTION_VIEW chooser + Activity Result extras when available
 * - iOS: Linking.openURL(upi://pay?...) — no success/fail callback from the UPI app
 * PIN entry happens only inside the external UPI app.
 */
export async function launchUpiIntent(upiUri: string): Promise<UpiLaunchResult> {
  assertSafeUpiUri(upiUri);
  if (Platform.OS === 'ios') {
    return launchUpiIntentIos(upiUri);
  }
  if (Platform.OS !== 'android' || !native?.pay) {
    return {kind: 'unsupported'};
  }
  try {
    const result = await native.pay(upiUri);
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
