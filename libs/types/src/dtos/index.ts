// Generated from contracts/api.yaml (manual sync step)
export interface ProductDTO {
  id: string;
  name: string;
  description: string;
  priceRial: number;
  images: string[];
  arModelId?: string | null;
  inventory: number;
}
export interface SellerDTO {
  id: string;
  name_fa: string;
  verified: boolean;
}
export type ARModelFormat = 'gltf' | 'glb';
export interface ARModelDTO {
  url: string;
  format: ARModelFormat;
}
export type AIPreviewType = 'search' | 'recommend';
export interface AIPreviewDTO {
  type: AIPreviewType;
  confidence: number;
  items: ProductDTO[];
}

/**
 * Production Product Repository
 * Implements Repository Pattern for database abstraction
 *
 * 🔴 ACTION REQUIRED: Configure database connection in .env
 * DATABASE_URL=postgresql://user:password@host:5432/dbname
 */

// API configuration
// 🔴 REQUIRED: Set NEXT_PUBLIC_API_BASE in environment - no fallback in production
const API_BASE_URL = (() => {
  const url = process.env.NEXT_PUBLIC_API_BASE;
  if (!url) {
    throw new Error('NEXT_PUBLIC_API_BASE environment variable is required');
  }
  return url;
})();

/**
 * Fetch product by ID from database via API
 * @param id Product identifier
 * @returns Product DTO or null if not found
 */
export async function getProduct(id: string): Promise<ProductDTO | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/products/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // 🔴 ACTION REQUIRED: Add authentication if needed
        // 'Authorization': `Bearer ${getAuthToken()}`
      },
      cache: 'no-store', // Always fetch fresh data
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`Product not found: ${id}`);
        return null;
      }
      throw new Error(`Failed to fetch product: ${response.statusText}`);
    }

    const product: ProductDTO = await response.json();
    return product;
  } catch (error) {
    console.error('Error fetching product:', error);
    // In production, you might want to throw or handle differently
    return null;
  }
}

/**
 * Fetch multiple products with filters
 * @param filters Query parameters for filtering
 * @returns Array of products
 */
export async function getProducts(filters?: {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<ProductDTO[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.category) {
      params.set('category', filters.category);
    }
    if (filters?.minPrice) {
      params.set('minPrice', filters.minPrice.toString());
    }
    if (filters?.maxPrice) {
      params.set('maxPrice', filters.maxPrice.toString());
    }
    if (filters?.search) {
      params.set('search', filters.search);
    }
    if (filters?.limit) {
      params.set('limit', filters.limit.toString());
    }
    if (filters?.offset) {
      params.set('offset', filters.offset.toString());
    }

    const url = `${API_BASE_URL}/api/products?${params.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch products: ${response.statusText}`);
    }

    const data = await response.json();
    return data.products || [];
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
}
