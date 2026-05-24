import {RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Geolocation from 'react-native-geolocation-service';
import React, {useMemo, useState} from 'react';
import {
  Alert,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import {COMPANY_AMOUNT_LIMIT} from '../constants/mockData';
import {
  FormInput,
  PrimaryButton,
  Screen,
  ScreenHeader,
  Section,
  SecondaryButton,
} from '../components/UI';
import {useAppData} from '../context/AppContext';
import {RootStackParamList} from '../navigation';
import {LocationPoint, UpiApp} from '../types';
import {getPolicyWarning, randomRef} from '../utils/upi';
import {toast} from '../utils/toast';
import {
  USE_RAZORPAY_UPI,
  confirmPaymentOnBackend,
  createPaymentOrder,
  isTerminalPaymentStatus,
  markCheckoutOpened,
  pollPaymentStatus,
} from '../services/payments';

const GOOGLE_PAY_PLAY =
  'https://play.google.com/store/apps/details?id=com.google.android.apps.nbu.paisa.user';
const GOOGLE_PAY_APP_STORE = 'https://apps.apple.com/app/google-pay/id1193357041';

type Route = RouteProp<RootStackParamList, 'Payment'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

const numberPattern = /^\d*\.?\d{0,2}$/;

const requestLocation = async (): Promise<LocationPoint> => {
  if (Platform.OS === 'android') {
    const permission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location permission',
        message:
          'Allpay captures one-time location at payment confirmation when enabled.',
        buttonPositive: 'Allow',
      },
    );
    if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
      return null;
    }
  }

  return new Promise(resolve => {
    Geolocation.getCurrentPosition(
      pos => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          capturedAt: new Date().toISOString(),
        });
      },
      () => resolve(null),
      {enableHighAccuracy: true, timeout: 7000},
    );
  });
};

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export const PaymentScreen = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {merchant} = route.params;
  const {
    profile,
    installedUpiApps,
    defaultUpiAppId,
    setDefaultUpiApp,
    addTransaction,
    setTransactionResult,
    updateTransactionPayment,
    locationEnabled,
  } = useAppData();

  const qrLockedAmount = merchant.amount;
  const [amount, setAmount] = useState(
    merchant.amount ? merchant.amount.toFixed(2) : '',
  );
  const [selectedAppId, setSelectedAppId] = useState<string | null>(
    defaultUpiAppId ?? (installedUpiApps[0]?.id ?? null),
  );
  const [paying, setPaying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const selectedApp = useMemo<UpiApp | undefined>(
    () => installedUpiApps.find(item => item.id === selectedAppId),
    [installedUpiApps, selectedAppId],
  );

  const chooseResult = (txId: string) => {
    Alert.alert('Simulate UPI callback', 'Select payment outcome', [
      {
        text: 'SUCCESS (00)',
        onPress: async () => {
          await setTransactionResult(txId, 'success');
          navigation.replace('TransactionDetail', {transactionId: txId});
        },
      },
      {
        text: 'PENDING',
        onPress: async () => {
          await setTransactionResult(txId, 'pending');
          navigation.replace('TransactionDetail', {transactionId: txId});
        },
      },
      {
        text: 'USER_CANCELLED',
        style: 'destructive',
        onPress: async () => {
          await setTransactionResult(txId, 'failure');
          navigation.replace('TransactionDetail', {transactionId: txId});
        },
      },
    ]);
  };

  const pollUntilTerminal = async (txId: string) => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const statusRes = await pollPaymentStatus(txId);
      if (statusRes.ok && statusRes.paymentStatus && isTerminalPaymentStatus(statusRes.paymentStatus)) {
        return statusRes.paymentStatus;
      }
      await sleep(2000);
    }
    return undefined;
  };

  const payWithRazorpay = async (txId: string, parsedAmount: number, selectedAppName: string) => {
    if (!profile) {
      return;
    }
    setStatusMessage('Creating payment order…');
    const orderRes = await createPaymentOrder({
      txId,
      amount: parsedAmount,
      employeeId: profile.employeeId,
      employeeName: profile.employeeName,
      department: profile.department,
      merchant,
      upiApp: selectedAppName,
    });
    if (!orderRes.ok || !orderRes.orderId || !orderRes.keyId) {
      toast.error('Payment unavailable', orderRes.message ?? 'Could not create Razorpay order.');
      await updateTransactionPayment(txId, {
        paymentStatus: 'payment_failed',
        status: 'Abandoned',
      });
      return;
    }

    await updateTransactionPayment(txId, {
      paymentStatus: 'order_created',
      razorpayOrderId: orderRes.orderId,
      status: 'Recorded',
    });

    await markCheckoutOpened(txId);
    setStatusMessage('Opening UPI app…');

    try {
      const checkoutData = await RazorpayCheckout.open({
        key: orderRes.keyId,
        amount: String(orderRes.amount ?? Math.round(parsedAmount * 100)),
        currency: orderRes.currency ?? 'INR',
        name: profile.companyName,
        description: `Payment to ${merchant.name}`,
        order_id: orderRes.orderId,
        method: 'upi',
        prefill: {
          name: profile.employeeName,
          contact: profile.mobile,
        },
        theme: {color: '#1d4ed8'},
      });

      setStatusMessage('Confirming payment…');
      const confirmRes = await confirmPaymentOnBackend({
        txId,
        razorpay_order_id: checkoutData.razorpay_order_id,
        razorpay_payment_id: checkoutData.razorpay_payment_id,
        razorpay_signature: checkoutData.razorpay_signature,
      });
      if (!confirmRes.ok) {
        toast.error('Confirmation failed', confirmRes.message ?? 'Could not verify payment.');
      }

      const finalStatus = (await pollUntilTerminal(txId)) ?? confirmRes.paymentStatus ?? 'payment_processing';
      const captured = finalStatus === 'payment_captured';
      await updateTransactionPayment(txId, {
        paymentStatus: finalStatus,
        razorpayOrderId: orderRes.orderId,
        razorpayPaymentId: checkoutData.razorpay_payment_id,
        upiRefId: checkoutData.razorpay_payment_id,
        status: captured ? 'Recorded' : finalStatus === 'payment_failed' ? 'Abandoned' : 'Recorded',
      });

      if (captured) {
        toast.success('Payment captured', 'Your UPI payment was confirmed.');
      } else if (finalStatus === 'payment_failed') {
        toast.error('Payment failed', 'Please try again.');
      } else {
        toast.info('Payment processing', 'We are still confirming your payment.');
      }
      navigation.replace('TransactionDetail', {transactionId: txId});
    } catch (error: unknown) {
      const message =
        typeof error === 'object' && error !== null && 'description' in error
          ? String((error as {description?: string}).description ?? 'Payment cancelled')
          : 'Payment cancelled';
      await updateTransactionPayment(txId, {
        paymentStatus: 'payment_abandoned',
        status: 'Abandoned',
      });
      toast.error('Payment cancelled', message);
    }
  };

  const doPayment = async () => {
    const parsedAmount = Number(amount);
    if (!amount || !numberPattern.test(amount)) {
      toast.error('Invalid amount', 'Enter a valid numeric amount up to 2 decimals.');
      return;
    }
    if (parsedAmount <= 0) {
      toast.error('Invalid amount', 'Amount must be greater than zero.');
      return;
    }
    if (!selectedApp) {
      toast.error('UPI app required', 'Install a UPI app or get one from the store below.');
      return;
    }

    const warning = getPolicyWarning(parsedAmount, merchant.category);
    const continuePayment = async () => {
      if (paying) {
        return;
      }
      setPaying(true);
      try {
        await setDefaultUpiApp(selectedApp.id);
        const location = locationEnabled ? await requestLocation() : null;
        const tx = await addTransaction({
          merchant,
          amount: parsedAmount,
          upiAppName: selectedApp.name,
          upiRefId: randomRef('UPI'),
          policyWarning: warning ?? undefined,
          warningAcknowledged: Boolean(warning),
          location,
        });

        if (USE_RAZORPAY_UPI) {
          await payWithRazorpay(tx.id, parsedAmount, selectedApp.name);
          return;
        }

        const link = `upi://pay?pa=${encodeURIComponent(merchant.vpa)}&pn=${encodeURIComponent(merchant.name)}&am=${parsedAmount.toFixed(2)}&cu=INR`;
        try {
          await Linking.openURL(link);
        } catch {
          toast.error('Handoff failed', 'Unable to open the selected UPI app.');
        }
        chooseResult(tx.id);
      } finally {
        setPaying(false);
        setStatusMessage(null);
      }
    };

    if (parsedAmount > COMPANY_AMOUNT_LIMIT) {
      toast.info(
        'Limit warning',
        `Amount exceeds company threshold of INR ${COMPANY_AMOUNT_LIMIT}.`,
      );
    }

    if (warning) {
      Alert.alert('Policy warning', warning, [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Proceed anyway', onPress: () => continuePayment()},
      ]);
      return;
    }
    await continuePayment();
  };

  return (
    <Screen safeTop={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader
          title="Confirm Payment"
          subtitle={
            USE_RAZORPAY_UPI
              ? 'Pay via Razorpay UPI. Merchant QR details are recorded for reimbursement.'
              : 'Review merchant details and continue to your preferred UPI app.'
          }
        />

        {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}

        <Section title="Merchant details">
          <FormInput value={merchant.name} editable={false} />
          <FormInput value={merchant.vpa} editable={false} />
          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <Text style={styles.metaLabel}>Category: {merchant.category}</Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaLabel}>MCC: {merchant.mcc}</Text>
            </View>
          </View>
        </Section>

        <Section title="Payment amount">
          <FormInput
            value={amount}
            onChangeText={text => {
              if (qrLockedAmount !== undefined) {
                return;
              }
              if (numberPattern.test(text)) {
                setAmount(text);
              }
            }}
            editable={qrLockedAmount === undefined}
            keyboardType="decimal-pad"
            placeholder="Enter amount in INR"
          />
          {qrLockedAmount !== undefined ? (
            <Text style={styles.helpText}>Amount is fixed by the merchant QR.</Text>
          ) : (
            <Text style={styles.helpText}>
              Company threshold warning: INR {COMPANY_AMOUNT_LIMIT}
            </Text>
          )}
        </Section>

        <Section title="Select UPI app">
          {installedUpiApps.length === 0 ? (
            <View>
              <Text style={styles.warningText}>
                No UPI app detected. Install a UPI app, then return and tap refresh in
                Settings, or use the store link below.
              </Text>
              <SecondaryButton
                label={Platform.OS === 'ios' ? 'Get a UPI app (App Store)' : 'Get Google Pay (Play Store)'}
                onPress={() =>
                  Linking.openURL(
                    Platform.OS === 'ios' ? GOOGLE_PAY_APP_STORE : GOOGLE_PAY_PLAY,
                  )
                }
              />
            </View>
          ) : (
            installedUpiApps.map(app => (
              <Pressable
                key={app.id}
                onPress={() => setSelectedAppId(app.id)}
                style={[
                  styles.appRow,
                  selectedAppId === app.id ? styles.appRowActive : null,
                ]}>
                <Text style={styles.appLogo}>{app.logo}</Text>
                <View style={styles.appInfo}>
                  <Text style={styles.appName}>{app.name}</Text>
                  <Text style={styles.appSub}>
                    {selectedAppId === app.id ? 'Default app selected' : 'Tap to select'}
                  </Text>
                </View>
                <View style={styles.radioDotOuter}>
                  {selectedAppId === app.id ? <View style={styles.radioDotInner} /> : null}
                </View>
              </Pressable>
            ))
          )}
        </Section>

        <PrimaryButton
          label={USE_RAZORPAY_UPI ? 'Pay with Razorpay UPI' : 'Proceed to UPI app'}
          onPress={doPayment}
        />
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flexGrow: 1,
  },
  statusMessage: {
    color: '#1d4ed8',
    fontWeight: '600',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metaPill: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  metaLabel: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  helpText: {
    color: '#64748b',
    fontSize: 12,
  },
  warningText: {
    color: '#b45309',
    marginBottom: 6,
    fontWeight: '600',
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 10,
    backgroundColor: '#ffffff',
  },
  appRowActive: {
    borderColor: '#1d4ed8',
    backgroundColor: '#eff6ff',
  },
  appLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#bfdbfe',
    color: '#1e3a8a',
    fontWeight: '800',
    textAlign: 'center',
    textAlignVertical: 'center',
    overflow: 'hidden',
    paddingTop: 8,
    fontSize: 12,
  },
  appInfo: {
    flex: 1,
  },
  appName: {
    color: '#0f172a',
    fontWeight: '700',
  },
  appSub: {
    marginTop: 1,
    color: '#64748b',
    fontSize: 12,
  },
  radioDotOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderColor: '#94a3b8',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1d4ed8',
  },
});
