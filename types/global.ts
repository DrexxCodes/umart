// src/types/global.ts

export interface PaystackResponse {
  reference: string;
  status: string;
  message: string;
  data: {
    id: number;
    reference: string;
    amount: number;
    paid_at: string;
    customer: {
      email: string;
    };
  };
}

declare global {
  interface Window {
    PaystackPop: {
      setup: (config: PaystackConfig) => {
        openIframe: () => void;
      };
    };
  }
}

interface PaystackConfig {
  key: string;
  email: string;
  amount: number;
  ref: string;
  currency?: string;
  metadata?: {
    custom_fields?: Array<{
      display_name: string;
      variable_name: string;
      value: string;
    }>;
    [key: string]: unknown;
  };
  onClose: () => void;
  onSuccess?: (response: PaystackResponse) => void; // kept for backwards compat
  callback?: (response: PaystackResponse) => void;  // Paystack inline v1 name
}

export {};