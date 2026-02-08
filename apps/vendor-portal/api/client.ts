/**
 * Vendor Portal API Client
 * 🔐 Zero-Trust: API URL MUST be configured via environment
 */

function getApiUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    throw new Error('NEXT_PUBLIC_API_URL environment variable is required');
  }

  return apiUrl;
}

const API_URL = getApiUrl();

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const token =
    typeof window !== 'undefined' ? document.cookie.split('vendor-token=')[1]?.split(';')[0] : '';

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
      ...options.headers,
    },
    credentials: 'include',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `API Error: ${res.statusText}`);
  }

  return res.json();
}

export const productAPI = {
  fetchProducts: (vendorId: string) => fetchAPI(`/api/vendors/${vendorId}/products`),
  createProduct: (vendorId: string, data: any) =>
    fetchAPI(`/api/vendors/${vendorId}/products`, { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (vendorId: string, productId: string, data: any) =>
    fetchAPI(`/api/vendors/${vendorId}/products/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  publishProduct: (vendorId: string, productId: string) =>
    fetchAPI(`/api/vendors/${vendorId}/products/${productId}/publish`, { method: 'POST' }),
};

export const orderAPI = {
  fetchOrders: (vendorId: string) => fetchAPI(`/api/vendors/${vendorId}/orders`),
  updateOrderStatus: (vendorId: string, orderId: string, status: string) =>
    fetchAPI(`/api/vendors/${vendorId}/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

export const financialAPI = {
  fetchFinancials: (vendorId: string) => fetchAPI(`/api/vendors/${vendorId}/financials`),
  fetchWallet: (vendorId: string) => fetchAPI(`/api/vendors/${vendorId}/wallet`),
  requestPayout: (vendorId: string, amount: number) =>
    fetchAPI(`/api/vendors/${vendorId}/payouts`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
};

export const brandingAPI = {
  fetchBranding: (vendorId: string) => fetchAPI(`/api/vendors/${vendorId}/branding`),
  updateBranding: (vendorId: string, data: any) =>
    fetchAPI(`/api/vendors/${vendorId}/branding`, { method: 'PATCH', body: JSON.stringify(data) }),
};
