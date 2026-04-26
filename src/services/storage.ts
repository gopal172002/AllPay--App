import AsyncStorage from '@react-native-async-storage/async-storage';
import {OnboardingProfile, Transaction} from '../types';

const KEYS = {
  profile: 'allpay.profile',
  transactions: 'allpay.transactions',
  defaultUpiAppId: 'allpay.defaultUpiAppId',
  locationEnabled: 'allpay.locationEnabled',
};

export const storage = {
  async saveProfile(profile: OnboardingProfile): Promise<void> {
    await AsyncStorage.setItem(KEYS.profile, JSON.stringify(profile));
  },

  async getProfile(): Promise<OnboardingProfile | null> {
    const raw = await AsyncStorage.getItem(KEYS.profile);
    return raw ? (JSON.parse(raw) as OnboardingProfile) : null;
  },

  async saveTransactions(items: Transaction[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.transactions, JSON.stringify(items));
  },

  async getTransactions(): Promise<Transaction[]> {
    const raw = await AsyncStorage.getItem(KEYS.transactions);
    return raw ? (JSON.parse(raw) as Transaction[]) : [];
  },

  async setDefaultUpiAppId(id: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.defaultUpiAppId, id);
  },

  async getDefaultUpiAppId(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.defaultUpiAppId);
  },

  async setLocationEnabled(value: boolean): Promise<void> {
    await AsyncStorage.setItem(KEYS.locationEnabled, JSON.stringify(value));
  },

  async getLocationEnabled(): Promise<boolean> {
    const raw = await AsyncStorage.getItem(KEYS.locationEnabled);
    return raw ? Boolean(JSON.parse(raw)) : false;
  },

  async clearSession(): Promise<void> {
    await AsyncStorage.multiRemove([
      KEYS.profile,
      KEYS.transactions,
      KEYS.defaultUpiAppId,
      KEYS.locationEnabled,
    ]);
  },
};
