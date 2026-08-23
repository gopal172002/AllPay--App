import {Linking, Platform} from 'react-native';
import {
  hasCompatibleUpiApp,
  launchUpiIntent,
} from '../../src/upi/payment/UpiPaymentLauncher';

jest.mock('../../src/services/upiApps', () => ({
  detectInstalledUpiApps: jest.fn(async () => [{id: 'gpay', name: 'Google Pay'}]),
}));

describe('UpiPaymentLauncher iOS', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    // @ts-expect-error test override
    Platform.OS = 'ios';
    jest.spyOn(Linking, 'canOpenURL').mockImplementation(async (url: string) => {
      return (
        url.startsWith('paytmmp://') ||
        url.startsWith('phonepe://') ||
        url.startsWith('gpay://') ||
        url.startsWith('tez://') ||
        url.startsWith('bhim://')
      );
    });
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    // @ts-expect-error restore
    Platform.OS = originalOS;
    jest.restoreAllMocks();
  });

  it('detects a compatible UPI app on iOS without using WhatsApp upi://', async () => {
    await expect(
      hasCompatibleUpiApp('upi://pay?pa=shop@upi&am=1.00'),
    ).resolves.toBe(true);
  });

  it('opens Paytm deep link instead of bare upi://', async () => {
    const result = await launchUpiIntent('upi://pay?pa=shop@upi&am=1.00', {
      preferredAppId: 'paytm',
    });
    expect(result).toEqual({kind: 'opened'});
    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringMatching(/^paytmmp:\/\/pay\?pa=shop%40upi&am=1\.00|paytmmp:\/\/pay\?pa=shop@upi&am=1\.00/),
    );
    expect(Linking.openURL).not.toHaveBeenCalledWith(
      expect.stringMatching(/^upi:\/\//),
    );
  });

  it('refuses non-UPI URIs', async () => {
    await expect(launchUpiIntent('https://evil.example')).rejects.toThrow(
      /non-UPI/,
    );
  });
});
