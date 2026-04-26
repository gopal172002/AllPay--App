import {Linking} from 'react-native';
import {KNOWN_UPI_APPS} from '../constants/mockData';
import {UpiApp} from '../types';

export const detectInstalledUpiApps = async (): Promise<UpiApp[]> => {
  const checks = await Promise.all(
    KNOWN_UPI_APPS.map(async app => {
      try {
        const supported = await Linking.canOpenURL(app.scheme);
        return supported ? app : null;
      } catch {
        return null;
      }
    }),
  );
  return checks.filter((app): app is UpiApp => Boolean(app));
};
