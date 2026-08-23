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
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    // @ts-expect-error restore
    Platform.OS = originalOS;
    jest.restoreAllMocks();
  });

  it('detects a compatible UPI app on iOS', async () => {
    await expect(
      hasCompatibleUpiApp('upi://pay?pa=shop@upi&am=1.00'),
    ).resolves.toBe(true);
  });

  it('opens upi://pay on iOS and returns opened', async () => {
    const result = await launchUpiIntent('upi://pay?pa=shop@upi&am=1.00');
    expect(result).toEqual({kind: 'opened'});
    expect(Linking.openURL).toHaveBeenCalledWith('upi://pay?pa=shop@upi&am=1.00');
  });

  it('refuses non-UPI URIs', async () => {
    await expect(launchUpiIntent('https://evil.example')).rejects.toThrow(
      /non-UPI/,
    );
  });
});
