declare module 'react-native-razorpay' {
  type RazorpayCheckoutOptions = {
    key: string;
    amount: string;
    currency: string;
    name: string;
    description?: string;
    order_id: string;
    method?: string;
    prefill?: {
      name?: string;
      contact?: string;
      email?: string;
    };
    theme?: {
      color?: string;
    };
  };

  type RazorpayCheckoutSuccess = {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  };

  const RazorpayCheckout: {
    open(options: RazorpayCheckoutOptions): Promise<RazorpayCheckoutSuccess>;
  };

  export default RazorpayCheckout;
}
