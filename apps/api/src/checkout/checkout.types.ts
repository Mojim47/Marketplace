/**
 * Checkout Types
 * Enterprise Scalability Architecture - Stateless Backend
 * Requirements: 2.1, 2.5
 */

export interface CheckoutSession {
  id: string;
  userId: string;
  cartSnapshot: {
    items: Array<{
      productId: string;
      variantId?: string;
      productName: string;
      quantity: number;
      price: number;
    }>;
    subtotal: number;
    discount: number;
    discountCode?: string;
    shippingCost: number;
    taxAmount: number;
    total: number;
  };
  shippingAddress?: ShippingAddress;
  billingAddress?: BillingAddress;
  paymentMethod?: PaymentMethod;
  step: CheckoutStep;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export interface ShippingAddress {
  fullName: string;
  phone: string;
  province: string;
  city: string;
  address: string;
  postalCode: string;
}

export interface BillingAddress {
  fullName: string;
  phone: string;
  province: string;
  city: string;
  address: string;
  postalCode: string;
  nationalId?: string;
  companyName?: string;
  economicCode?: string;
}

export type PaymentMethod = 'ONLINE' | 'CARD_TO_CARD' | 'CREDIT' | 'CHEQUE';

export type CheckoutStep = 'CART' | 'SHIPPING' | 'PAYMENT' | 'REVIEW' | 'COMPLETE';

export interface InitCheckoutDto {
  // Cart is automatically loaded from Redis
}

export interface SetShippingAddressDto {
  sessionId: string;
  address: ShippingAddress;
}

export interface SetPaymentMethodDto {
  sessionId: string;
  method: PaymentMethod;
}

export interface CompleteCheckoutDto {
  sessionId: string;
}

export interface CheckoutConfig {
  sessionTtlSeconds: number;
}
