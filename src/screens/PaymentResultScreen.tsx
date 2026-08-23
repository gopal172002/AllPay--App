import {RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {
  PrimaryButton,
  Screen,
  ScreenHeader,
  SecondaryButton,
  StatusPill,
} from '../components/UI';
import {useAppData} from '../context/AppContext';
import {RootStackParamList} from '../navigation';
import {maskRef} from '../upi/mask';
import {paiseToRupeeLabel} from '../upi/money';
import {expenseIdForPayment} from '../upi/payment/expenseFromPayment';

type Route = RouteProp<RootStackParamList, 'PaymentResult'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export const PaymentResultScreen = () => {
  const navigation = useNavigation<Nav>();
  const {paymentId} = useRoute<Route>().params;
  const {upiPayments, applyUpiPaymentStatus, transactions} = useAppData();
  const payment = useMemo(
    () => upiPayments.find(item => item.id === paymentId),
    [paymentId, upiPayments],
  );
  const expense = useMemo(
    () =>
      transactions.find(
        item => item.paymentId === paymentId || item.id === payment?.expenseId,
      ),
    [payment?.expenseId, paymentId, transactions],
  );

  if (!payment) {
    return (
      <Screen safeTop={false}>
        <View style={styles.centered}>
          <Text style={styles.body}>Payment not found.</Text>
        </View>
      </Screen>
    );
  }

  const amountLabel = `₹${paiseToRupeeLabel(payment.amountPaise)}`;
  const status = payment.status;

  const title =
    status === 'SUCCESS_REPORTED'
      ? 'Payment recorded'
      : status === 'FAILED'
        ? 'Payment failed'
        : status === 'PENDING'
          ? 'Payment pending'
          : status === 'CANCELLED'
            ? 'Payment cancelled'
            : status === 'USER_CONFIRMED'
              ? 'Recorded by you'
              : 'Payment status unavailable';

  const subtitle =
    status === 'SUCCESS_REPORTED'
      ? 'UPI payment reported successful'
      : status === 'FAILED'
        ? 'No expense was added.'
        : status === 'PENDING'
          ? 'The UPI app reported that this transaction is still pending. Do not pay again unless you know the first payment failed.'
          : status === 'CANCELLED'
            ? 'The UPI app was closed before a result was returned.'
            : status === 'USER_CONFIRMED'
              ? 'You confirmed this payment. This is not a UPI app success callback.'
              : status === 'UPI_APP_OPENED'
                ? 'UPI ID was copied and your UPI app was opened. Pay there like a normal transfer (do not use auto-fill links — banks block those). Then tap I paid — record expense.'
                : "We couldn't determine the result of this payment. If you already paid, tap Record manually.";

  const toneStyle =
    status === 'SUCCESS_REPORTED'
      ? styles.successBox
      : status === 'FAILED' || status === 'CANCELLED'
        ? styles.failBox
        : styles.warnBox;

  const openExpense = () => {
    const id = expense?.id ?? expenseIdForPayment(payment.id);
    navigation.replace('TransactionDetail', {transactionId: id});
  };

  const recordManuallyLabel =
    status === 'UPI_APP_OPENED' || status === 'UNKNOWN'
      ? 'I paid — record expense'
      : 'Record manually';

  return (
    <Screen safeTop={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader title={title} subtitle={payment.payeeName} />
        <View style={[styles.box, toneStyle]}>
          <Text style={styles.amount}>{amountLabel}</Text>
          <Text style={styles.payee}>{payment.payeeName}</Text>
          <StatusPill status={status} />
          <Text style={styles.body}>{subtitle}</Text>
          {status === 'SUCCESS_REPORTED' ? (
            <Text style={styles.ref}>Reference: {maskRef(payment.upiTxnId ?? payment.upiTxnRef)}</Text>
          ) : null}
          {status === 'SUCCESS_REPORTED' ? (
            <Text style={styles.body}>Added to your expenses.</Text>
          ) : null}
        </View>

        {status === 'SUCCESS_REPORTED' || status === 'USER_CONFIRMED' ? (
          <PrimaryButton label="View expense" onPress={openExpense} />
        ) : null}

        {status === 'FAILED' || status === 'CANCELLED' ? (
          <PrimaryButton
            label="Try again"
            onPress={() =>
              navigation.replace('Payment', {
                merchant: {
                  vpa: payment.payeeVpa,
                  name: payment.payeeName,
                  category: payment.category,
                  mcc: payment.mcc,
                  amountPaise: payment.amountPaise,
                  note: payment.note,
                },
              })
            }
          />
        ) : null}

        {status === 'UNKNOWN' || status === 'PENDING' || status === 'UPI_APP_OPENED' || status === 'INITIATED' ? (
          <>
            <PrimaryButton
              label={recordManuallyLabel}
              onPress={async () => {
                await applyUpiPaymentStatus(payment.id, 'USER_CONFIRMED');
              }}
            />
            <SecondaryButton
              label={status === 'PENDING' ? 'Keep pending' : 'Dismiss'}
              onPress={() => navigation.popToTop()}
            />
          </>
        ) : (
          <SecondaryButton label="Done" onPress={() => navigation.popToTop()} />
        )}
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  successBox: {
    backgroundColor: '#ecfdf5',
    borderColor: '#bbf7d0',
  },
  failBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  warnBox: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  amount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  payee: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  body: {
    color: '#334155',
    lineHeight: 20,
  },
  ref: {
    color: '#475569',
    fontWeight: '700',
  },
});
