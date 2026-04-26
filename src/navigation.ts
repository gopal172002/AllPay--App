import {MerchantData} from './types';

export type RootStackParamList = {
  MainTabs: undefined;
  Scan: undefined;
  Payment: {merchant: MerchantData};
  TransactionDetail: {transactionId: string};
};
