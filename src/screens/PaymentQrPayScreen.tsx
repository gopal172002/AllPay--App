import {RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useEffect, useState} from 'react';
import {Image, ScrollView, StyleSheet, Text, View} from 'react-native';
import {
  PrimaryButton,
  Screen,
  ScreenHeader,
  SecondaryButton,
  Section,
} from '../components/UI';
import {useAppData} from '../context/AppContext';
import {RootStackParamList} from '../navigation';
import {toast} from '../utils/toast';
import {paiseToRupeeLabel} from '../upi/money';
import {
  launchUpiIntent,
  openUpiAppHome,
  upiQrImageUrl,
} from '../upi/payment/UpiPaymentLauncher';

type Route = RouteProp<RootStackParamList, 'PaymentQrPay'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

const APP_LABEL: Record<string, string> = {
  paytm: 'Paytm',
  phonepe: 'PhonePe',
  gpay: 'Google Pay',
  bhim: 'BHIM',
};

export const PaymentQrPayScreen = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {paymentId, upiUri, preferredAppId} = route.params;
  const {upiPayments, applyUpiPaymentStatus, markUpiAppOpened} = useAppData();
  const payment = upiPayments.find(item => item.id === paymentId);
  const [opening, setOpening] = useState(false);

  const appId = preferredAppId ?? 'paytm';
  const appName = APP_LABEL[appId] ?? 'UPI app';

  useEffect(() => {
    openUpiAppHome(appId).catch(() => undefined);
  }, [appId]);

  if (!payment) {
    return (
      <Screen safeTop={false}>
        <View style={styles.centered}>
          <Text style={styles.body}>Payment not found.</Text>
        </View>
      </Screen>
    );
  }

  const onOpenApp = async () => {
    setOpening(true);
    try {
      const result = await openUpiAppHome(appId);
      if (result.kind === 'no_app') {
        toast.error('App not found', `Install ${appName} and try again.`);
      }
    } finally {
      setOpening(false);
    }
  };

  const onTryAutoPay = async () => {
    setOpening(true);
    try {
      await markUpiAppOpened(payment.id);
      const launch = await launchUpiIntent(upiUri, {
        preferredAppId: appId,
        personalP2p: true,
      });
      if (launch.kind === 'no_app') {
        toast.error('No UPI app', `Install ${appName} and try again.`);
        return;
      }
      toast.info(
        'Auto-fill opened',
        'If SBI shows risk policy after PIN, come back and scan the QR above in Paytm instead.',
      );
      navigation.replace('PaymentResult', {paymentId: payment.id});
    } finally {
      setOpening(false);
    }
  };

  const onConfirmPaid = async () => {
    await applyUpiPaymentStatus(payment.id, 'USER_CONFIRMED');
    navigation.replace('PaymentResult', {paymentId: payment.id});
  };

  return (
    <Screen safeTop={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader
          title="Scan to pay"
          subtitle={`${payment.payeeName} · ₹${paiseToRupeeLabel(payment.amountPaise)}`}
        />

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Why scan instead of auto-pay?</Text>
          <Text style={styles.infoBody}>
            SBI and other banks often block auto-fill links to personal UPI IDs with
            “UPI risk policy” after PIN. Scanning this QR inside {appName} is the same
            as scanning the person’s original QR — that path works.
          </Text>
        </View>

        <Section title="Payment QR">
          <Image
            source={{uri: upiQrImageUrl(upiUri, 260)}}
            style={styles.qrImage}
            accessibilityLabel="Payment QR code"
          />
          <Text style={styles.steps}>
            1. Open {appName} → Scan & Pay{'\n'}
            2. Scan this QR on your screen{'\n'}
            3. Confirm amount → enter PIN{'\n'}
            4. Return here → tap I paid — record expense
          </Text>
        </Section>

        <PrimaryButton
          label={opening ? 'Opening…' : `Open ${appName}`}
          onPress={onOpenApp}
          disabled={opening}
        />
        <PrimaryButton
          label="I paid — record expense"
          onPress={onConfirmPaid}
          disabled={opening}
        />
        <SecondaryButton
          label="Try auto-fill anyway (may fail on personal UPI)"
          onPress={onTryAutoPay}
          disabled={opening}
        />
        <SecondaryButton label="Cancel" onPress={() => navigation.goBack()} />
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 18,
    paddingBottom: 24,
    flexGrow: 1,
    gap: 10,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBox: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  infoTitle: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 14,
  },
  infoBody: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 19,
  },
  qrImage: {
    width: 260,
    height: 260,
    alignSelf: 'center',
    marginVertical: 8,
  },
  steps: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 22,
    textAlign: 'center',
  },
  body: {
    color: '#334155',
  },
});
