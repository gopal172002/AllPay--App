import NetInfo from '@react-native-community/netinfo';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {toast} from '../utils/toast';
import {detectInstalledUpiApps} from '../services/upiApps';
import {storage} from '../services/storage';
import {clearEmployeeAuth, saveEmployeeAuth} from '../services/auth';
import {fetchActivePolicies, patchTransactionOnBackend, syncTransactionToBackend} from '../services/sync';
import {isPaymentCaptured} from '../services/payments';
import {OnboardingProfile, Receipt, Transaction, UpiApp} from '../types';
import type {ExpensePolicy} from '../utils/policies';
import type {UpiIntentPayment, UpiIntentStatus} from '../upi/model/types';
import {createUuid, launchTxnRefFromPaymentId} from '../upi/id';
import {expenseFromPayment} from '../upi/payment/expenseFromPayment';
import {
  applyUpiStatusTransition,
  recoverUnresolvedStatus,
  shouldCreateExpense,
} from '../upi/payment/UpiPaymentState';
import {
  createUpiPaymentRemote,
  syncUpiPaymentResult,
  toCreatePaymentBody,
} from '../upi/payment/UpiPaymentRepository';
import {trackUpiEvent} from '../upi/analytics';

type CreateUpiPaymentInput = {
  payeeVpa: string;
  payeeName: string;
  amountPaise: number;
  note?: string;
  category: string;
  mcc: string;
};

type AppContextValue = {
  profile: OnboardingProfile | null;
  transactions: Transaction[];
  upiPayments: UpiIntentPayment[];
  policies: ExpensePolicy[];
  installedUpiApps: UpiApp[];
  defaultUpiAppId: string | null;
  locationEnabled: boolean;
  syncMessage: string | null;
  completeOnboarding: (profile: OnboardingProfile) => Promise<void>;
  finishEmployeeLogin: (profile: OnboardingProfile, token: string) => Promise<void>;
  submitForReimbursement: (id: string, purpose: string, note: string) => Promise<void>;
  addReceipts: (id: string, receipts: Receipt[]) => Promise<void>;
  setDefaultUpiApp: (id: string) => Promise<void>;
  refreshInstalledUpiApps: () => Promise<void>;
  setLocationCaptureEnabled: (enabled: boolean) => Promise<void>;
  createUpiPayment: (input: CreateUpiPaymentInput) => Promise<UpiIntentPayment>;
  markUpiAppOpened: (paymentId: string) => Promise<UpiIntentPayment | null>;
  applyUpiPaymentStatus: (
    paymentId: string,
    status: UpiIntentStatus,
    refs?: {
      upiTxnId?: string;
      upiTxnRef?: string;
      approvalRefNo?: string;
      upiResponseCode?: string;
    },
  ) => Promise<UpiIntentPayment | null>;
  logout: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider = ({children}: {children: React.ReactNode}) => {
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [upiPayments, setUpiPayments] = useState<UpiIntentPayment[]>([]);
  const [policies, setPolicies] = useState<ExpensePolicy[]>([]);
  const [installedUpiApps, setInstalledUpiApps] = useState<UpiApp[]>([]);
  const [defaultUpiAppId, setDefaultUpiAppId] = useState<string | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const transactionsRef = useRef<Transaction[]>([]);
  const upiPaymentsRef = useRef<UpiIntentPayment[]>([]);
  const profileRef = useRef<OnboardingProfile | null>(null);
  transactionsRef.current = transactions;
  upiPaymentsRef.current = upiPayments;
  profileRef.current = profile;

  const saveTransactions = useCallback(async (items: Transaction[]) => {
    transactionsRef.current = items;
    setTransactions(items);
    await storage.saveTransactions(items);
  }, []);

  const saveUpiPayments = useCallback(async (items: UpiIntentPayment[]) => {
    upiPaymentsRef.current = items;
    setUpiPayments(items);
    await storage.saveUpiPayments(items);
  }, []);

  const syncSingleIfOnline = useCallback(
    async (tx: Transaction) => {
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        return tx;
      }
      const response = await syncTransactionToBackend(tx, profileRef.current);
      if (!response.ok) {
        return tx;
      }
      const updated = {...tx, syncStatus: 'synced' as const};
      setSyncMessage(`Synced transaction ${updated.id}`);
      return updated;
    },
    [],
  );

  const flushQueued = useCallback(async () => {
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      return;
    }
    const current = transactionsRef.current;
    const queued = current.filter(item => item.syncStatus === 'queued');
    if (!queued.length) {
      return;
    }
    const next = [...current];
    for (const tx of queued) {
      const synced = await syncSingleIfOnline(tx);
      const index = next.findIndex(item => item.id === tx.id);
      if (index > -1) {
        next[index] = synced;
      }
    }
    await saveTransactions(next);
  }, [saveTransactions, syncSingleIfOnline]);

  useEffect(() => {
    const bootstrap = async () => {
      const [savedProfile, savedTxs, savedPayments, savedDefault, savedLocation] = await Promise.all([
        storage.getProfile(),
        storage.getTransactions(),
        storage.getUpiPayments(),
        storage.getDefaultUpiAppId(),
        storage.getLocationEnabled(),
      ]);
      setProfile(savedProfile);
      profileRef.current = savedProfile;
      setTransactions(savedTxs);
      transactionsRef.current = savedTxs;
      const recovered = savedPayments.map(item => ({
        ...item,
        status: recoverUnresolvedStatus(item.status),
      }));
      await saveUpiPayments(recovered);
      setDefaultUpiAppId(savedDefault);
      setLocationEnabled(savedLocation);
      if (savedProfile?.employeeId) {
        const policyRes = await fetchActivePolicies(savedProfile.employeeId);
        if (policyRes.ok) {
          setPolicies(policyRes.policies);
        }
      }
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
  }, [saveUpiPayments]);

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
    profileRef.current = nextProfile;
    setProfile(nextProfile);
    const policyRes = await fetchActivePolicies(nextProfile.employeeId);
    if (policyRes.ok) {
      setPolicies(policyRes.policies);
    }
  }, []);

  const finishEmployeeLogin = useCallback(async (nextProfile: OnboardingProfile, token: string) => {
    await saveEmployeeAuth(token, nextProfile.employeeId);
    await storage.saveProfile(nextProfile);
    profileRef.current = nextProfile;
    setProfile(nextProfile);
    const policyRes = await fetchActivePolicies(nextProfile.employeeId);
    if (policyRes.ok) {
      setPolicies(policyRes.policies);
    }
  }, []);

  const submitForReimbursement = useCallback(
    async (id: string, purpose: string, note: string) => {
      const current = transactionsRef.current.find(item => item.id === id);
      if (current && !isPaymentCaptured(current.paymentStatus)) {
        toast.error('Payment required', 'Confirm the merchant payment before submitting for reimbursement.');
        return;
      }
      const next = transactionsRef.current.map(item =>
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
      const activeProfile = profileRef.current;
      if (activeProfile) {
        const net = await NetInfo.fetch();
        if (net.isConnected) {
          void patchTransactionOnBackend(
            id,
            {
              employeeId: activeProfile.employeeId,
              status: 'Pending Approval',
              reimbursementPurpose: purpose,
              reimbursementNote: note,
            },
            activeProfile,
          ).catch(() => null);
        }
      }
    },
    [saveTransactions],
  );

  const addReceipts = useCallback(
    async (id: string, receipts: Receipt[]) => {
      const next = transactionsRef.current.map(item => {
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
      const activeProfile = profileRef.current;
      if (updated && activeProfile) {
        const net = await NetInfo.fetch();
        if (net.isConnected) {
          void patchTransactionOnBackend(
            id,
            {employeeId: activeProfile.employeeId, receipts: updated.receipts},
            activeProfile,
          ).catch(() => null);
        }
      }
    },
    [saveTransactions],
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

  const upsertExpenseForPayment = useCallback(
    async (payment: UpiIntentPayment, remoteExpenseId?: string) => {
      const activeProfile = profileRef.current;
      if (!activeProfile || !shouldCreateExpense(payment.status)) {
        return;
      }
      if (transactionsRef.current.some(item => item.paymentId === payment.id)) {
        return;
      }
      const expense = expenseFromPayment(payment, activeProfile.employeeId, remoteExpenseId);
      await saveTransactions([expense, ...transactionsRef.current]);
      trackUpiEvent('expense_created_from_upi');
      const net = await NetInfo.fetch();
      if (net.isConnected && !remoteExpenseId) {
        void syncTransactionToBackend(expense, activeProfile).catch(() => null);
      }
    },
    [saveTransactions],
  );

  const createUpiPayment = useCallback(
    async (input: CreateUpiPaymentInput) => {
      const activeProfile = profileRef.current;
      if (!activeProfile) {
        throw new Error('Profile missing');
      }
      const id = createUuid();
      const payment: UpiIntentPayment = {
        id,
        userId: activeProfile.employeeId,
        amountPaise: input.amountPaise,
        currency: 'INR',
        payeeName: input.payeeName,
        payeeVpa: input.payeeVpa,
        note: input.note,
        category: input.category,
        mcc: input.mcc,
        paymentMethod: 'UPI_INTENT',
        status: 'INITIATED',
        initiatedAt: new Date().toISOString(),
        launchTxnRef: launchTxnRefFromPaymentId(id),
      };
      await saveUpiPayments([payment, ...upiPaymentsRef.current]);
      await createUpiPaymentRemote(toCreatePaymentBody(payment, activeProfile.employeeId));
      return payment;
    },
    [saveUpiPayments],
  );

  const markUpiAppOpened = useCallback(
    async (paymentId: string) => {
      const current = upiPaymentsRef.current.find(item => item.id === paymentId);
      if (!current) {
        return null;
      }
      const transition = applyUpiStatusTransition(current.status, 'UPI_APP_OPENED');
      if (!transition.ok) {
        return current;
      }
      const updated = {...current, status: transition.status};
      await saveUpiPayments(
        upiPaymentsRef.current.map(item => (item.id === paymentId ? updated : item)),
      );
      return updated;
    },
    [saveUpiPayments],
  );

  const applyUpiPaymentStatus = useCallback(
    async (
      paymentId: string,
      status: UpiIntentStatus,
      refs?: {
        upiTxnId?: string;
        upiTxnRef?: string;
        approvalRefNo?: string;
        upiResponseCode?: string;
      },
    ) => {
      const current = upiPaymentsRef.current.find(item => item.id === paymentId);
      if (!current) {
        return null;
      }
      const transition = applyUpiStatusTransition(current.status, status);
      if (!transition.ok) {
        return current;
      }
      const now = new Date().toISOString();
      const updated: UpiIntentPayment = {
        ...current,
        status: transition.status,
        upiTxnId: refs?.upiTxnId ?? current.upiTxnId,
        upiTxnRef: refs?.upiTxnRef ?? current.upiTxnRef,
        approvalRefNo: refs?.approvalRefNo ?? current.approvalRefNo,
        upiResponseCode: refs?.upiResponseCode ?? current.upiResponseCode,
        returnedAt: current.returnedAt ?? now,
        completedAt:
          shouldCreateExpense(transition.status) ||
          transition.status === 'FAILED' ||
          transition.status === 'CANCELLED'
            ? current.completedAt ?? now
            : current.completedAt,
      };
      await saveUpiPayments(
        upiPaymentsRef.current.map(item => (item.id === paymentId ? updated : item)),
      );
      const employeeId = profileRef.current?.employeeId ?? updated.userId;
      const remote = await syncUpiPaymentResult(updated, employeeId);
      if (shouldCreateExpense(updated.status)) {
        await upsertExpenseForPayment(
          {...updated, expenseId: remote.expenseId ?? updated.expenseId},
          remote.expenseId,
        );
      }
      return updated;
    },
    [saveUpiPayments, upsertExpenseForPayment],
  );

  const logout = useCallback(async () => {
    await clearEmployeeAuth();
    await storage.clearSession();
    profileRef.current = null;
    transactionsRef.current = [];
    upiPaymentsRef.current = [];
    setProfile(null);
    setTransactions([]);
    setUpiPayments([]);
    setPolicies([]);
    setDefaultUpiAppId(null);
    setLocationEnabled(false);
    setSyncMessage(null);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      profile,
      transactions,
      upiPayments,
      policies,
      installedUpiApps,
      defaultUpiAppId,
      locationEnabled,
      syncMessage,
      completeOnboarding,
      finishEmployeeLogin,
      submitForReimbursement,
      addReceipts,
      setDefaultUpiApp,
      refreshInstalledUpiApps,
      setLocationCaptureEnabled,
      createUpiPayment,
      markUpiAppOpened,
      applyUpiPaymentStatus,
      logout,
    }),
    [
      addReceipts,
      applyUpiPaymentStatus,
      completeOnboarding,
      createUpiPayment,
      finishEmployeeLogin,
      defaultUpiAppId,
      installedUpiApps,
      locationEnabled,
      markUpiAppOpened,
      profile,
      policies,
      refreshInstalledUpiApps,
      setDefaultUpiApp,
      setLocationCaptureEnabled,
      logout,
      submitForReimbursement,
      syncMessage,
      transactions,
      upiPayments,
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
