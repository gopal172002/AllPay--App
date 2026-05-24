export type PaymentStatus =
  | 'draft'
  | 'order_created'
  | 'checkout_opened'
  | 'payment_processing'
  | 'payment_captured'
  | 'payment_failed'
  | 'payment_abandoned'
  | 'legacy_simulated';

export type TransactionStatus =
  | 'Recorded'
  | 'Pending Approval'
  | 'Approved'
  | 'Rejected'
  | 'Flagged'
  | 'Abandoned';

export type SyncStatus = 'synced' | 'queued';

export type UpiApp = {
  id: string;
  name: string;
  logo: string;
  scheme: string;
  storeUrl: string;
};

export type MerchantData = {
  vpa: string;
  name: string;
  category: string;
  mcc: string;
  amount?: number;
};

export type Receipt = {
  id: string;
  uri: string;
  fileName: string;
  fileSize: number;
  type: string;
};

export type LocationPoint = {
  latitude: number;
  longitude: number;
  capturedAt: string;
} | null;

export type Transaction = {
  id: string;
  employeeId: string;
  merchant: MerchantData;
  amount: number;
  timestamp: string;
  upiApp: string;
  upiRefId?: string;
  status: TransactionStatus;
  syncStatus: SyncStatus;
  reimbursementPurpose?: string;
  reimbursementNote?: string;
  reimbursementDate?: string;
  reimbursementAmount?: number;
  adminNote?: string;
  rejectionReason?: string;
  policyWarning?: string;
  warningAcknowledged?: boolean;
  receipts: Receipt[];
  location: LocationPoint;
  paymentStatus?: PaymentStatus;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  orderAmountPaise?: number;
  capturedAmountPaise?: number;
  paymentMethod?: string;
  paymentFailedReason?: string;
  paymentConfirmedAt?: string;
};

export type OnboardingProfile = {
  companyId: string;
  companyName: string;
  employeeId: string;
  employeeName: string;
  department: string;
  mobile: string;
};

export type Filters = {
  status: 'All' | TransactionStatus;
  category: 'All' | string;
  dateRange: 'All' | '7d' | '30d';
};
