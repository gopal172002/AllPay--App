import {RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useState} from 'react';
import {Alert, Platform, ScrollView, StyleSheet, Text, View} from 'react-native';
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
import {buildUpiPayUri} from '../upi/scanner/UpiQrParser';
import {
  detectIosPaymentUpiApps,
  hasCompatibleUpiApp,
  launchUpiIntent,
} from '../upi/payment/UpiPaymentLauncher';
import {
  mapUpiResultToStatus,
  parseUpiPaymentResult,
} from '../upi/payment/UpiPaymentResultParser';

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
      'Choose a UPI app to complete payment.',
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

      const uri = buildUpiPayUri({
        payeeVpa: merchant.vpa,
        payeeName: merchant.name,
        amountPaise: parsedPaise,
        note: merchant.note,
        merchantTransactionRef: merchant.qrTransactionRef,
        merchantCategoryCode: merchant.merchantCategoryCode,
        baseSanitizedUri: merchant.sanitizedUri,
      });

      const hasApp = await hasCompatibleUpiApp(uri);
      if (!hasApp) {
        await applyUpiPaymentStatus(payment.id, 'CANCELLED');
        toast.error(
          'No UPI app',
          'Install Google Pay, PhonePe, Paytm, or BHIM, then try again.',
        );
        navigation.replace('PaymentResult', {paymentId: payment.id});
        return;
      }

      let preferredAppId = defaultUpiAppId;
      if (Platform.OS === 'ios') {
        const iosApps = await detectIosPaymentUpiApps();
        const defaultAvailable =
          defaultUpiAppId && iosApps.some(app => app.id === defaultUpiAppId);
        if (defaultAvailable) {
          preferredAppId = defaultUpiAppId;
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

      await markUpiAppOpened(payment.id);
      setStatusMessage('Opening UPI app...');
      trackUpiEvent('upi_app_launched');
      const launch = await launchUpiIntent(uri, {preferredAppId});

      if (launch.kind === 'no_app') {
        await applyUpiPaymentStatus(payment.id, 'CANCELLED');
        toast.error(
          'No UPI app',
          'Install Google Pay, PhonePe, Paytm, or BHIM, then try again.',
        );
      } else if (launch.kind === 'cancelled') {
        await applyUpiPaymentStatus(payment.id, 'CANCELLED');
        trackUpiEvent('upi_result_cancelled');
      } else if (launch.kind === 'unsupported') {
        await applyUpiPaymentStatus(payment.id, 'UNKNOWN');
      } else if (launch.kind === 'opened') {
        trackUpiEvent('upi_result_unknown');
        toast.info(
          'Complete payment in UPI app',
          'After PIN, return here. If the bank blocks the link, tap I paid — record expense only after money is sent.',
        );
      } else {
        const parsed = parseUpiPaymentResult(launch.raw);
        const mapped = mapUpiResultToStatus(parsed, merchant.qrTransactionRef);
        await applyUpiPaymentStatus(payment.id, mapped, {
          upiTxnId: parsed.transactionId ?? undefined,
          upiTxnRef: parsed.transactionReference ?? undefined,
          approvalRefNo: parsed.approvalReference ?? undefined,
          upiResponseCode: parsed.responseCode ?? undefined,
        });
        if (mapped === 'SUCCESS_REPORTED') {
          trackUpiEvent('upi_result_success');
        } else if (mapped === 'FAILED') {
          trackUpiEvent('upi_result_failed');
          toast.error(
            'UPI app reported failure',
            'Try Google Pay or PhonePe, or a shop merchant QR. Personal UPI IDs are often blocked by bank risk rules on auto-pay links.',
          );
        } else if (mapped === 'PENDING') {
          trackUpiEvent('upi_result_pending');
        } else {
          trackUpiEvent('upi_result_unknown');
        }
      }
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

    if (warning) {
      Alert.alert('Policy warning', warning, [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Proceed anyway', onPress: () => continuePayment(parsedPaise)},
      ]);
      return;
    }
    await continuePayment(parsedPaise);
  };

  const displayPaise =
    qrLockedPaise !== undefined ? qrLockedPaise : parseRupeeInputToPaise(amountText);
  const payLabel =
    displayPaise && isSaneAmountPaise(displayPaise)
      ? `Pay ₹${paiseToRupeeLabel(displayPaise)}`
      : 'Continue to UPI';

  return (
    <Screen safeTop={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader
          title="Confirm Payment"
          subtitle="Opens your UPI app with the scanned payee. PIN is entered only in that app."
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
          Best success: scan a shop / merchant UPI QR (with merchant code). Personal
          UPI IDs are often blocked by banks on auto-open links — that is NPCI risk
          policy, not AllPay PIN handling. On iPhone after pay, confirm with “I paid”
          if status is unknown.
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
