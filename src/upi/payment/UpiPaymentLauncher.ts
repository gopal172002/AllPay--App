import {NativeModules, Platform} from 'react-native';

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
  | {kind: 'cancelled'}
  | {kind: 'no_app'}
  | {kind: 'unsupported'};

function assertSafeUpiUri(upiUri: string): void {
  if (!upiUri.toLowerCase().startsWith('upi://pay?')) {
    throw new Error('Refusing to launch a non-UPI payment URI');
  }
}

export async function hasCompatibleUpiApp(upiUri: string): Promise<boolean> {
  assertSafeUpiUri(upiUri);
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
 * Opens Android's UPI app chooser via ACTION_VIEW.
 * PIN entry happens only inside the external UPI app.
 */
export async function launchUpiIntent(upiUri: string): Promise<UpiLaunchResult> {
  assertSafeUpiUri(upiUri);
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
