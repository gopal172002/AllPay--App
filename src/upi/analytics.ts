/**
 * Product analytics only. Never send VPA, txn ids, QR payloads, or callbacks.
 */
export type UpiAnalyticsEvent =
  | 'upi_scan_started'
  | 'upi_qr_scanned'
  | 'upi_qr_invalid'
  | 'upi_payment_confirmed'
  | 'upi_app_launched'
  | 'upi_result_success'
  | 'upi_result_failed'
  | 'upi_result_pending'
  | 'upi_result_unknown'
  | 'upi_result_cancelled'
  | 'expense_created_from_upi';

export function trackUpiEvent(event: UpiAnalyticsEvent): void {
  if (__DEV__) {
    console.debug(`[upi-analytics] ${event}`);
  }
}
