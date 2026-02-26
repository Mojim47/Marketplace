export type CatalogProduct = {
  id: string;
  name: string;
  slug: string;
  category: string;
  seller: string;
  priceIrr: number;
  rating: number;
  minOrderQty: number;
  stock: number;
  eta: string;
  badge: 'Top Rated' | 'Fast Shipping' | 'Verified Supplier' | 'Trending';
  image: string;
  summary: string;
};

export const CATALOG_PRODUCTS: CatalogProduct[] = [
  {
    id: 'p-ultra-5g',
    name: 'AIMarket Ultra 5G',
    slug: 'aimarket-ultra-5g',
    category: 'mobile',
    seller: 'Nova Devices',
    priceIrr: 69900000,
    rating: 4.9,
    minOrderQty: 1,
    stock: 34,
    eta: 'تحویل 24 ساعته',
    badge: 'Top Rated',
    image: '/images/products/phone-ultra.jpg',
    summary: 'گوشی پرچم‌دار با پردازش AI روی دستگاه و باتری دو روزه.',
  },
  {
    id: 'p-sound-pro-max',
    name: 'Sound Pro Max ANC',
    slug: 'sound-pro-max-anc',
    category: 'audio-video',
    seller: 'Audio Craft',
    priceIrr: 18400000,
    rating: 4.8,
    minOrderQty: 2,
    stock: 76,
    eta: 'ارسال امروز',
    badge: 'Fast Shipping',
    image: '/images/products/headphones.jpg',
    summary: 'هدفون حرفه‌ای با نویزکنسلینگ تطبیقی و میکروفون استودیویی.',
  },
  {
    id: 'p-home-neural-kit',
    name: 'Home Neural Kit',
    slug: 'home-neural-kit',
    category: 'smart-home',
    seller: 'Home Sense',
    priceIrr: 32500000,
    rating: 4.7,
    minOrderQty: 1,
    stock: 21,
    eta: 'تحویل 48 ساعته',
    badge: 'Verified Supplier',
    image: '/images/products/smart-home.jpg',
    summary: 'پکیج خانه هوشمند شامل هاب مرکزی، سنسور و اتوماسیون کامل.',
  },
  {
    id: 'p-vision-mini',
    name: 'Vision Mini Cam',
    slug: 'vision-mini-cam',
    category: 'audio-video',
    seller: 'Lumen Store',
    priceIrr: 9900000,
    rating: 4.6,
    minOrderQty: 3,
    stock: 58,
    eta: 'تحویل فردا',
    badge: 'Trending',
    image: '/images/products/camera.jpg',
    summary: 'دوربین سبک روزمره با الگوریتم تشخیص صحنه.',
  },
  {
    id: 'p-compute-x9',
    name: 'Compute X9 Edge',
    slug: 'compute-x9-edge',
    category: 'compute',
    seller: 'Core Matrix',
    priceIrr: 54000000,
    rating: 4.9,
    minOrderQty: 1,
    stock: 17,
    eta: 'ارسال فوری',
    badge: 'Verified Supplier',
    image: '/images/products/laptop.jpg',
    summary: 'ایستگاه پردازش لبه برای بارهای AI/ML با پایداری صنعتی.',
  },
  {
    id: 'p-mesh-router-ax',
    name: 'Mesh Router AX',
    slug: 'mesh-router-ax',
    category: 'compute',
    seller: 'NetPro',
    priceIrr: 8800000,
    rating: 4.5,
    minOrderQty: 4,
    stock: 92,
    eta: 'تحویل 24 ساعته',
    badge: 'Fast Shipping',
    image: '/images/products/router.jpg',
    summary: 'روتر مش سازمانی با پوشش چندطبقه و مدیریت مرکزی.',
  },
  {
    id: 'p-smart-watch-s7',
    name: 'Smart Watch S7',
    slug: 'smart-watch-s7',
    category: 'mobile',
    seller: 'Pulse Market',
    priceIrr: 12700000,
    rating: 4.4,
    minOrderQty: 2,
    stock: 63,
    eta: 'تحویل امروز',
    badge: 'Trending',
    image: '/images/products/smartwatch.jpg',
    summary: 'ساعت هوشمند با سنجش سلامت، GPS و اعلان‌های زنده.',
  },
  {
    id: 'p-air-speaker-360',
    name: 'Air Speaker 360',
    slug: 'air-speaker-360',
    category: 'audio-video',
    seller: 'Orion Tech',
    priceIrr: 7600000,
    rating: 4.6,
    minOrderQty: 3,
    stock: 112,
    eta: 'ارسال سریع',
    badge: 'Fast Shipping',
    image: '/images/products/speaker.jpg',
    summary: 'اسپیکر 360 درجه با اتصال چندنقطه‌ای و بیس تقویت‌شده.',
  },
  {
    id: 'p-display-neo-32',
    name: 'Display Neo 32 4K',
    slug: 'display-neo-32-4k',
    category: 'compute',
    seller: 'Pixel Hub',
    priceIrr: 24900000,
    rating: 4.8,
    minOrderQty: 1,
    stock: 26,
    eta: 'تحویل 48 ساعته',
    badge: 'Top Rated',
    image: '/images/products/monitor.jpg',
    summary: 'مانیتور 4K حرفه‌ای با دقت رنگ بالا و نرخ تازه‌سازی 144Hz.',
  },
  {
    id: 'p-secure-lock-pro',
    name: 'Secure Lock Pro',
    slug: 'secure-lock-pro',
    category: 'smart-home',
    seller: 'Trust IoT',
    priceIrr: 11300000,
    rating: 4.7,
    minOrderQty: 2,
    stock: 49,
    eta: 'تحویل 24 ساعته',
    badge: 'Verified Supplier',
    image: '/images/products/lock.jpg',
    summary: 'قفل هوشمند سازمانی با احراز هویت چندمرحله‌ای.',
  },
];

export function findProductBySlug(slug: string) {
  return CATALOG_PRODUCTS.find((item) => item.slug === slug || item.id === slug) ?? null;
}

export function findProductById(id: string) {
  return CATALOG_PRODUCTS.find((item) => item.id === id || item.slug === id) ?? null;
}
