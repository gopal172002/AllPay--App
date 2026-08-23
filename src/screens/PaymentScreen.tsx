import {RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useState} from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {COMPANY_AMOUNT_LIMIT} from '../constants/mockData';
import {
  FormInput,
  PrimaryButton,
  Screen,
  ScreenHeader,
  Section,
} from '../components/UI';
import {useAppData} from '../context/AppContext';
import {RootStackParamList} from '../navigation';
import {getPolicyWarningFromPolicies} from '../utils/policies';
import {toast} from '../utils/toast';
import {trackUpiEvent} from '../upi/analytics';
import {isSaneAmountPaise, paiseToRupeeLabel, parseRupeeInputToPaise} from '../upi/money';
import {
  detectIosPaymentUpiApps,
  hasCompatibleUpiApp,
  openUpiAppHome,
} from '../upi/payment/UpiPaymentLauncher';

type Route = RouteProp<RootStackParamList, 'Payment'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

const DetailRow = ({label, value}: {label: string; value: string}) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue} numberOfLines={2}>
      {value}
    </Text>
  </View>
);

function appLabelFor(id: string | null | undefined): string {
  if (id === 'phonepe') {
    return 'PhonePe';
  }
  if (id === 'gpay') {
    return 'Google Pay';
  }
  if (id === 'bhim') {
    return 'BHIM';
  }
  return 'Paytm';
}

function pickIosUpiApp(
  apps: Array<{id: string; name: string}>,
  preferredId: string | null,
): Promise<string | null> {
  if (apps.length === 0) {
    return Promise.resolve(null);
  }
  if (apps.length === 1) {
    return Promise.resolve(apps[0].id);
  }
  return new Promise(resolve => {
    const preferred = preferredId
      ? apps.find(app => app.id === preferredId)
      : undefined;
    const ordered = preferred
      ? [preferred, ...apps.filter(app => app.id !== preferred.id)]
      : apps;
    Alert.alert(
      'Pay with',
      'Choose a UPI app. Pay inside that app (same as you do normally).',
      [
        ...ordered.map(app => ({
          text: app.name,
          onPress: () => resolve(app.id),
        })),
        {text: 'Cancel', style: 'cancel' as const, onPress: () => resolve(null)},
      ],
      {cancelable: true, onDismiss: () => resolve(null)},
    );
  });
}

export const PaymentScreen = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {merchant} = route.params;
  const {
    profile,
    policies,
    transactions,
    defaultUpiAppId,
    createUpiPayment,
    markUpiAppOpened,
    applyUpiPaymentStatus,
  } = useAppData();

  const qrLockedPaise = merchant.amountPaise;
  const [amountText, setAmountText] = useState(
    qrLockedPaise !== undefined ? paiseToRupeeLabel(qrLockedPaise) : '',
  );
  const [paying, setPaying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const continuePayment = async (parsedPaise: number) => {
    if (paying || !profile) {
      return;
    }
    setPaying(true);
    try {
      setStatusMessage('Saving payment...');
      const payment = await createUpiPayment({
        payeeVpa: merchant.vpa,
        payeeName: merchant.name,
        amountPaise: parsedPaise,
        note: merchant.note,
        category: merchant.category,
        mcc: merchant.mcc,
      });
      trackUpiEvent('upi_payment_confirmed');

      const probeUri = `upi://pay?pa=${merchant.vpa}&am=${paiseToRupeeLabel(parsedPaise)}&cu=INR`;
      const hasApp = await hasCompatibleUpiApp(probeUri);
      if (!hasApp) {
        await applyUpiPaymentStatus(payment.id, 'CANCELLED');
        toast.error(
          'No UPI app',
          'Install Google Pay, PhonePe, Paytm, or BHIM, then try again.',
        );
        navigation.replace('PaymentResult', {paymentId: payment.id});
        return;
      }

      let preferredAppId = defaultUpiAppId ?? 'paytm';
      if (Platform.OS === 'ios') {
        const iosApps = await detectIosPaymentUpiApps();
        const defaultAvailable =
          defaultUpiAppId && iosApps.some(app => app.id === defaultUpiAppId);
        if (defaultAvailable) {
          preferredAppId = defaultUpiAppId as string;
        } else {
          const chosen = await pickIosUpiApp(iosApps, defaultUpiAppId);
          if (!chosen) {
            await applyUpiPaymentStatus(payment.id, 'CANCELLED');
            trackUpiEvent('upi_result_cancelled');
            navigation.replace('PaymentResult', {paymentId: payment.id});
            return;
          }
          preferredAppId = chosen;
        }
      }

      const amountLabel = paiseToRupeeLabel(parsedPaise);
      const appLabel = appLabelFor(preferredAppId);

      // Copy VPA so user can paste in Paytm — same path as direct Paytm pay.
      try {
        Clipboard.setString(merchant.vpa);
      } catch {
        // clipboard optional
      }

      await markUpiAppOpened(payment.id);
      setStatusMessage(`Opening ${appLabel}…`);
      trackUpiEvent('upi_app_launched');

      const launch = await openUpiAppHome(preferredAppId);
      if (launch.kind === 'no_app' || launch.kind === 'unsupported') {
        toast.info(
          'UPI ID copied',
          `Open ${appLabel} yourself. Pay ₹${amountLabel} to ${merchant.vpa}, then return here.`,
        );
      } else {
        toast.success(
          'UPI ID copied',
          `In ${appLabel}, pay ₹${amountLabel} to the copied UPI ID, then return here.`,
        );
      }

      // Stay on result with UPI_APP_OPENED so user can confirm after paying.
      navigation.replace('PaymentResult', {paymentId: payment.id});
    } finally {
      setPaying(false);
      setStatusMessage(null);
    }
  };

  const onConfirm = async () => {
    const parsedPaise =
      qrLockedPaise !== undefined ? qrLockedPaise : parseRupeeInputToPaise(amountText);
    if (parsedPaise === null) {
      toast.error('Invalid amount', 'Enter a valid amount in rupees.');
      return;
    }
    if (!isSaneAmountPaise(parsedPaise)) {
      toast.error('Invalid amount', 'Amount must be between ₹1.00 and ₹1,00,000.00.');
      return;
    }

    const warning =
      profile && policies.length
        ? getPolicyWarningFromPolicies(
            Number(paiseToRupeeLabel(parsedPaise)),
            merchant.category,
            profile.employeeId,
            profile.department,
            policies,
            transactions,
          )
        : null;

    if (parsedPaise > COMPANY_AMOUNT_LIMIT * 100) {
      toast.info(
        'Limit warning',
        `Amount exceeds company threshold of INR ${COMPANY_AMOUNT_LIMIT}.`,
      );
    }

    const startPay = () => {
      if (warning) {
        Alert.alert('Policy warning', warning, [
          {text: 'Cancel', style: 'cancel'},
          {text: 'Proceed anyway', onPress: () => continuePayment(parsedPaise)},
        ]);
        return;
      }
      continuePayment(parsedPaise);
    };

    Alert.alert(
      'How payment works',
      'Banks block auto-open UPI links for personal UPI IDs (risk policy). AllPay will copy the UPI ID and open Paytm/PhonePe — you pay there the same way as a normal transfer, then confirm here.',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Continue', onPress: startPay},
      ],
    );
  };

  const displayPaise =
    qrLockedPaise !== undefined ? qrLockedPaise : parseRupeeInputToPaise(amountText);
  const payLabel =
    displayPaise && isSaneAmountPaise(displayPaise)
      ? `Pay ₹${paiseToRupeeLabel(displayPaise)} in UPI app`
      : 'Continue to UPI app';

  return (
    <Screen safeTop={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader
          title="Confirm Payment"
          subtitle="Pay inside your UPI app (same as a normal transfer). AllPay only tracks the expense."
        />

        {statusMessage ? (
          <View style={styles.statusBanner}>
            <Text style={styles.statusMessage}>{statusMessage}</Text>
          </View>
        ) : null}

        <Section title="Payee">
          <DetailRow label="Name" value={merchant.name} />
          <DetailRow label="UPI ID" value={merchant.vpa} />
          {merchant.note ? <DetailRow label="Note" value={merchant.note} /> : null}
        </Section>

        <Section title="Amount">
          <FormInput
            value={amountText}
            onChangeText={text => {
              if (qrLockedPaise !== undefined) {
                return;
              }
              if (text === '' || /^\d+(\.\d{0,2})?$/.test(text)) {
                setAmountText(text);
              }
            }}
            editable={qrLockedPaise === undefined}
            keyboardType="decimal-pad"
            placeholder="Enter amount in INR"
          />
          {qrLockedPaise !== undefined ? (
            <Text style={styles.helpText}>Amount is fixed by the merchant QR.</Text>
          ) : (
            <Text style={styles.helpText}>
              Company threshold warning: INR {COMPANY_AMOUNT_LIMIT}
            </Text>
          )}
        </Section>

        <Text style={styles.disclaimer}>
          Auto-fill UPI links are blocked by bank risk policy for personal UPI IDs.
          AllPay copies the UPI ID and opens your app — pay there, then tap
          “I paid — record expense”.
        </Text>

        <PrimaryButton
          label={paying ? 'Opening UPI…' : payLabel}
          onPress={onConfirm}
          disabled={paying}
        />
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 18,
    paddingBottom: 24,
    flexGrow: 1,
  },
  statusBanner: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  statusMessage: {
    color: '#1557d5',
    fontWeight: '800',
  },
  detailRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
    paddingBottom: 10,
    marginBottom: 10,
  },
  detailLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  detailValue: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  helpText: {
    color: '#64748b',
    fontSize: 12,
  },
  disclaimer: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
});
