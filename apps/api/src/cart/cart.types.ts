/**
 * Cart Types
 * Enterprise Scalability Architecture - Stateless Backend
 * Requirements: 2.1, 2.5
 */

export interface CartItem {
  productId: string;
  variantId?: string;
  productName: string;
  productSku: string;
  quantity: number;
  price: number;
  imageUrl?: string;
}

export interface Cart {
  userId: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  discountCode?: string;
  shippingCost: number;
  taxAmount: number;
  total: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddToCartDto {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface UpdateCartItemDto {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface ApplyDiscountDto {
  code: string;
}

export interface CartConfig {
  ttlSeconds: number;
  maxItems: number;
  taxRate: number;
}
