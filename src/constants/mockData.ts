import {OnboardingProfile, UpiApp} from '../types';

export const COMPANY_AMOUNT_LIMIT = 5000;

export const EXPENSE_PURPOSES = [
  'Client meeting',
  'Travel',
  'Office supplies',
  'Fuel',
  'Food',
  'Warehouse operations',
];

export const KNOWN_UPI_APPS: UpiApp[] = [
  {
    id: 'gpay',
    name: 'Google Pay',
    logo: 'G',
    scheme: 'gpay://upi/pay',
    storeUrl:
      'https://play.google.com/store/apps/details?id=com.google.android.apps.nbu.paisa.user',
  },
  {
    id: 'phonepe',
    name: 'PhonePe',
    logo: 'P',
    scheme: 'phonepe://pay',
    storeUrl:
      'https://play.google.com/store/apps/details?id=com.phonepe.app',
  },
  {
    id: 'paytm',
    name: 'Paytm',
    logo: 'PT',
    scheme: 'paytmmp://pay',
    storeUrl:
      'https://play.google.com/store/apps/details?id=net.one97.paytm',
  },
  {
    id: 'bhim',
    name: 'BHIM',
    logo: 'B',
    scheme: 'bhim://upi/pay',
    storeUrl: 'https://play.google.com/store/apps/details?id=in.org.npci.upiapp',
  },
];

const INVITES: Record<string, OnboardingProfile> = {
  ALLPAY123: {
    companyId: 'cmp_001',
    companyName: 'Allpay Logistics Pvt Ltd',
    employeeId: 'EMP-4452',
    employeeName: 'Ravi Kumar',
    department: 'Field Sales',
    mobile: '+91 90000 11223',
  },
  OPS8899: {
    companyId: 'cmp_001',
    companyName: 'Allpay Logistics Pvt Ltd',
    employeeId: 'EMP-9981',
    employeeName: 'Asha Singh',
    department: 'Operations',
    mobile: '+91 95555 22110',
  },
};

export const resolveInviteCode = (code: string): OnboardingProfile | null =>
  INVITES[code.trim().toUpperCase()] ?? null;
