import {MerchantData} from './types';

export type RootStackParamList = {
  MainTabs: undefined;
  Scan: undefined;
  Payment: {merchant: MerchantData};
  PaymentQrPay: {
    paymentId: string;
    upiUri: string;
    preferredAppId: string;
  };
  PaymentResult: {paymentId: string};
  TransactionDetail: {transactionId: string};
};
