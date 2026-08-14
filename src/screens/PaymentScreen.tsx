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
import {hasCompatibleUpiApp, launchUpiIntent} from '../upi/payment/UpiPaymentLauncher';
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

export const PaymentScreen = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {merchant} = route.params;
  const {
    profile,
    policies,
    transactions,
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
        transactionReference: payment.launchTxnRef,
      });

      if (Platform.OS !== 'android') {
        await applyUpiPaymentStatus(payment.id, 'UNKNOWN');
        toast.error(
          'Android required',
          'UPI Intent payments are supported on Android devices with a UPI app.',
        );
        navigation.replace('PaymentResult', {paymentId: payment.id});
        return;
      }

      const hasApp = await hasCompatibleUpiApp(uri);
      if (!hasApp) {
        await applyUpiPaymentStatus(payment.id, 'CANCELLED');
        toast.error(
          'No UPI app',
          'No compatible UPI payment app was found on this device.',
        );
        navigation.replace('PaymentResult', {paymentId: payment.id});
        return;
      }

      await markUpiAppOpened(payment.id);
      setStatusMessage('Opening UPI app...');
      trackUpiEvent('upi_app_launched');
      const launch = await launchUpiIntent(uri);

      if (launch.kind === 'no_app') {
        await applyUpiPaymentStatus(payment.id, 'CANCELLED');
        toast.error(
          'No UPI app',
          'No compatible UPI payment app was found on this device.',
        );
      } else if (launch.kind === 'cancelled') {
        await applyUpiPaymentStatus(payment.id, 'CANCELLED');
        trackUpiEvent('upi_result_cancelled');
      } else if (launch.kind === 'unsupported') {
        await applyUpiPaymentStatus(payment.id, 'UNKNOWN');
      } else {
        const parsed = parseUpiPaymentResult(launch.raw);
        const mapped = mapUpiResultToStatus(parsed, payment.launchTxnRef);
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
          subtitle="Pay the scanned payee in any installed UPI app. Expenzo does not collect this money."
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
          You will choose PhonePe, Google Pay, Paytm, BHIM, or a bank UPI app next.
          Enter your UPI PIN only inside that app.
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
