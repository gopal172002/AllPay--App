import NetInfo from '@react-native-community/netinfo';
import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {toast} from '../utils/toast';
import {detectInstalledUpiApps} from '../services/upiApps';
import {storage} from '../services/storage';
import {patchTransactionOnBackend, syncTransactionToBackend} from '../services/sync';
import {LocationPoint, OnboardingProfile, Receipt, Transaction, UpiApp} from '../types';
import {randomRef} from '../utils/upi';

type RecordInput = {
  merchant: Transaction['merchant'];
  amount: number;
  upiAppName: string;
  upiRefId?: string;
  policyWarning?: string;
  warningAcknowledged?: boolean;
  location: LocationPoint;
};

type AppContextValue = {
  profile: OnboardingProfile | null;
  transactions: Transaction[];
  installedUpiApps: UpiApp[];
  defaultUpiAppId: string | null;
  locationEnabled: boolean;
  syncMessage: string | null;
  completeOnboarding: (profile: OnboardingProfile) => Promise<void>;
  addTransaction: (input: RecordInput) => Promise<Transaction>;
  setTransactionResult: (id: string, status: 'success' | 'failure' | 'pending') => Promise<void>;
  submitForReimbursement: (id: string, purpose: string, note: string) => Promise<void>;
  addReceipts: (id: string, receipts: Receipt[]) => Promise<void>;
  setDefaultUpiApp: (id: string) => Promise<void>;
  refreshInstalledUpiApps: () => Promise<void>;
  setLocationCaptureEnabled: (enabled: boolean) => Promise<void>;
  logout: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider = ({children}: {children: React.ReactNode}) => {
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [installedUpiApps, setInstalledUpiApps] = useState<UpiApp[]>([]);
  const [defaultUpiAppId, setDefaultUpiAppId] = useState<string | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const saveTransactions = useCallback(async (items: Transaction[]) => {
    setTransactions(items);
    await storage.saveTransactions(items);
  }, []);

  const syncSingleIfOnline = useCallback(
    async (tx: Transaction) => {
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        return tx;
      }
      const response = await syncTransactionToBackend(tx, profile);
      if (!response.ok) {
        return tx;
      }
      const updated = {...tx, syncStatus: 'synced' as const};
      setSyncMessage(`Synced transaction ${updated.id}`);
      return updated;
    },
    [profile],
  );

  const flushQueued = useCallback(async () => {
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      return;
    }
    const queued = transactions.filter(item => item.syncStatus === 'queued');
    if (!queued.length) {
      return;
    }
    const next = [...transactions];
    for (const tx of queued) {
      const synced = await syncSingleIfOnline(tx);
      const index = next.findIndex(item => item.id === tx.id);
      if (index > -1) {
        next[index] = synced;
      }
    }
    await saveTransactions(next);
  }, [saveTransactions, syncSingleIfOnline, transactions]);

  useEffect(() => {
    const bootstrap = async () => {
      const [savedProfile, savedTxs, savedDefault, savedLocation] = await Promise.all([
        storage.getProfile(),
        storage.getTransactions(),
        storage.getDefaultUpiAppId(),
        storage.getLocationEnabled(),
      ]);
      setProfile(savedProfile);
      setTransactions(savedTxs);
      setDefaultUpiAppId(savedDefault);
      setLocationEnabled(savedLocation);
      const apps = await detectInstalledUpiApps();
      setInstalledUpiApps(apps);
      if (!savedDefault && apps.length === 1) {
        await storage.setDefaultUpiAppId(apps[0].id);
        setDefaultUpiAppId(apps[0].id);
      }
    };
    bootstrap().catch(() => {
      toast.error('Init failed', 'Could not load saved app data.');
    });
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        flushQueued().catch(() => null);
      }
    });
    return unsubscribe;
  }, [flushQueued]);

  const completeOnboarding = useCallback(async (nextProfile: OnboardingProfile) => {
    await storage.saveProfile(nextProfile);
    setProfile(nextProfile);
  }, []);

  const addTransaction = useCallback(
    async (input: RecordInput) => {
      if (!profile) {
        throw new Error('Profile missing');
      }
      const id = randomRef('TXN');
      const tx: Transaction = {
        id,
        employeeId: profile.employeeId,
        merchant: input.merchant,
        amount: input.amount,
        timestamp: new Date().toISOString(),
        upiApp: input.upiAppName,
        upiRefId: input.upiRefId,
        status: 'Recorded',
        syncStatus: 'queued',
        receipts: [],
        location: input.location,
        policyWarning: input.policyWarning,
        warningAcknowledged: input.warningAcknowledged,
      };
      const net = await NetInfo.fetch();
      const maybeSynced =
        net.isConnected && tx.status === 'Recorded'
          ? await syncSingleIfOnline(tx)
          : tx;
      const next = [maybeSynced, ...transactions];
      await saveTransactions(next);
      return maybeSynced;
    },
    [profile, saveTransactions, syncSingleIfOnline, transactions],
  );

  const setTransactionResult = useCallback(
    async (id: string, status: 'success' | 'failure' | 'pending') => {
      const next: Transaction[] = transactions.map(item => {
        if (item.id !== id) {
          return item;
        }
        if (status === 'success') {
          return {
            ...item,
            upiRefId: item.upiRefId ?? randomRef('UPI'),
            status: 'Recorded' as const,
          };
        }
        if (status === 'pending') {
          return {...item, status: 'Flagged' as const};
        }
        return {...item, status: 'Abandoned' as const};
      });
      await saveTransactions(next);
      const updatedTx = next.find(item => item.id === id);
      if (updatedTx && profile) {
        const net = await NetInfo.fetch();
        if (net.isConnected) {
          void syncTransactionToBackend(updatedTx, profile).catch(() => null);
        }
      }
    },
    [profile, saveTransactions, transactions],
  );

  const submitForReimbursement = useCallback(
    async (id: string, purpose: string, note: string) => {
      const next = transactions.map(item =>
        item.id === id
          ? {
              ...item,
              reimbursementPurpose: purpose,
              reimbursementNote: note,
              status: 'Pending Approval' as const,
            }
          : item,
      );
      await saveTransactions(next);
      setSyncMessage('Reimbursement submitted. You will be notified on approval.');
      if (profile) {
        const net = await NetInfo.fetch();
        if (net.isConnected) {
          void patchTransactionOnBackend(
            id,
            {
              employeeId: profile.employeeId,
              status: 'Pending Approval',
              reimbursementPurpose: purpose,
              reimbursementNote: note,
            },
            profile,
          ).catch(() => null);
        }
      }
    },
    [profile, saveTransactions, transactions],
  );

  const addReceipts = useCallback(
    async (id: string, receipts: Receipt[]) => {
      const next = transactions.map(item => {
        if (item.id !== id) {
          return item;
        }
        return {
          ...item,
          receipts: [...item.receipts, ...receipts].slice(0, 3),
        };
      });
      await saveTransactions(next);
      const updated = next.find(item => item.id === id);
      if (updated && profile) {
        const net = await NetInfo.fetch();
        if (net.isConnected) {
          void patchTransactionOnBackend(
            id,
            {employeeId: profile.employeeId, receipts: updated.receipts},
            profile,
          ).catch(() => null);
        }
      }
    },
    [profile, saveTransactions, transactions],
  );

  const setDefaultUpiApp = useCallback(async (id: string) => {
    await storage.setDefaultUpiAppId(id);
    setDefaultUpiAppId(id);
  }, []);

  const refreshInstalledUpiApps = useCallback(async () => {
    const apps = await detectInstalledUpiApps();
    setInstalledUpiApps(apps);
    if (apps.length === 1) {
      await storage.setDefaultUpiAppId(apps[0].id);
      setDefaultUpiAppId(apps[0].id);
    }
  }, []);

  const setLocationCaptureEnabled = useCallback(async (enabled: boolean) => {
    await storage.setLocationEnabled(enabled);
    setLocationEnabled(enabled);
  }, []);

  const logout = useCallback(async () => {
    await storage.clearSession();
    setProfile(null);
    setTransactions([]);
    setDefaultUpiAppId(null);
    setLocationEnabled(false);
    setSyncMessage(null);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      profile,
      transactions,
      installedUpiApps,
      defaultUpiAppId,
      locationEnabled,
      syncMessage,
      completeOnboarding,
      addTransaction,
      setTransactionResult,
      submitForReimbursement,
      addReceipts,
      setDefaultUpiApp,
      refreshInstalledUpiApps,
      setLocationCaptureEnabled,
      logout,
    }),
    [
      addReceipts,
      addTransaction,
      completeOnboarding,
      defaultUpiAppId,
      installedUpiApps,
      locationEnabled,
      profile,
      refreshInstalledUpiApps,
      setDefaultUpiApp,
      setLocationCaptureEnabled,
      logout,
      setTransactionResult,
      submitForReimbursement,
      syncMessage,
      transactions,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppData = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppData must be used inside AppProvider');
  }
  return context;
};
