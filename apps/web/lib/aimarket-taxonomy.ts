export type TaxonomyNode = {
  key: string;
  slug: string;
  name: string;
  description: string;
  level: 1 | 2 | 3;
  sortOrder: number;
  isFeatured: boolean;
  children?: TaxonomyNode[];
};

export const aimarketTaxonomy: TaxonomyNode[] = [
  {
    key: 'mobile',
    slug: 'mobile',
    name: 'موبایل و گجت',
    description: 'محصولات موبایل، گجت و لوازم جانبی',
    level: 1,
    sortOrder: 10,
    isFeatured: true,
    children: [
      {
        key: 'mobile-flagship',
        slug: 'flagship',
        name: 'پرچمدارها',
        description: 'گوشی های پرچمدار',
        level: 2,
        sortOrder: 11,
        isFeatured: true,
        children: [
          {
            key: 'android-flagship',
            slug: 'android-flagship',
            name: 'اندروید پرچمدار',
            description: 'پرچمداران اندرویدی',
            level: 3,
            sortOrder: 111,
            isFeatured: true,
          },
          {
            key: 'ios-flagship',
            slug: 'ios-flagship',
            name: 'iOS پرچمدار',
            description: 'پرچمداران iOS',
            level: 3,
            sortOrder: 112,
            isFeatured: true,
          },
        ],
      },
      {
        key: 'mobile-accessories',
        slug: 'mobile-accessories',
        name: 'لوازم جانبی موبایل',
        description: 'اکسسوری موبایل',
        level: 2,
        sortOrder: 12,
        isFeatured: false,
        children: [
          {
            key: 'charger-cable',
            slug: 'charger-cable',
            name: 'شارژر و کابل',
            description: 'شارژر، کابل و مبدل',
            level: 3,
            sortOrder: 121,
            isFeatured: false,
          },
          {
            key: 'case-protection',
            slug: 'case-protection',
            name: 'قاب و محافظ',
            description: 'محافظ نمایشگر و بدنه',
            level: 3,
            sortOrder: 122,
            isFeatured: false,
          },
        ],
      },
    ],
  },
  {
    key: 'smart-home',
    slug: 'smart-home',
    name: 'خانه هوشمند',
    description: 'اتوماسیون، امنیت و تجهیزات خانه هوشمند',
    level: 1,
    sortOrder: 20,
    isFeatured: true,
    children: [
      {
        key: 'smart-home-security',
        slug: 'security',
        name: 'امنیت و سنسور',
        description: 'دوربین و سنسورهای امنیتی',
        level: 2,
        sortOrder: 21,
        isFeatured: true,
        children: [
          {
            key: 'camera',
            slug: 'camera',
            name: 'دوربین امنیتی',
            description: 'انواع دوربین نظارتی',
            level: 3,
            sortOrder: 211,
            isFeatured: true,
          },
          {
            key: 'sensor',
            slug: 'sensor',
            name: 'سنسور هوشمند',
            description: 'سنسورهای حرکتی و محیطی',
            level: 3,
            sortOrder: 212,
            isFeatured: true,
          },
        ],
      },
      {
        key: 'smart-home-lighting',
        slug: 'lighting',
        name: 'روشنایی هوشمند',
        description: 'لامپ، کلید و کنترل روشنایی',
        level: 2,
        sortOrder: 22,
        isFeatured: false,
      },
    ],
  },
  {
    key: 'compute',
    slug: 'compute',
    name: 'محصولات پردازشی',
    description: 'لپ تاپ، شبکه و ذخیره سازی حرفه ای',
    level: 1,
    sortOrder: 30,
    isFeatured: true,
    children: [
      {
        key: 'compute-laptop',
        slug: 'laptop',
        name: 'لپ تاپ',
        description: 'لپ تاپ های حرفه ای و عمومی',
        level: 2,
        sortOrder: 31,
        isFeatured: true,
        children: [
          {
            key: 'gaming-laptop',
            slug: 'gaming-laptop',
            name: 'لپ تاپ گیمینگ',
            description: 'سیستم های گیمینگ قابل حمل',
            level: 3,
            sortOrder: 311,
            isFeatured: true,
          },
          {
            key: 'creator-laptop',
            slug: 'creator-laptop',
            name: 'لپ تاپ تولید محتوا',
            description: 'لپ تاپ های تولید محتوا',
            level: 3,
            sortOrder: 312,
            isFeatured: true,
          },
        ],
      },
      {
        key: 'compute-network',
        slug: 'network',
        name: 'شبکه و ذخیره سازی',
        description: 'سرور، NAS و تجهیزات شبکه',
        level: 2,
        sortOrder: 32,
        isFeatured: false,
      },
    ],
  },
  {
    key: 'audio-video',
    slug: 'audio-video',
    name: 'صوت و تصویر',
    description: 'تلویزیون، صوت خانگی و دوربین',
    level: 1,
    sortOrder: 40,
    isFeatured: true,
    children: [
      {
        key: 'audio-video-tv',
        slug: 'tv',
        name: 'تلویزیون',
        description: 'تلویزیون های هوشمند',
        level: 2,
        sortOrder: 41,
        isFeatured: true,
      },
      {
        key: 'audio-video-sound',
        slug: 'sound',
        name: 'هدفون و اسپیکر',
        description: 'تجهیزات شنیداری حرفه ای',
        level: 2,
        sortOrder: 42,
        isFeatured: true,
      },
    ],
  },
];

export type FlatTaxonomyNode = TaxonomyNode & { parentKey: string | null };

export function flattenTaxonomy(
  nodes: TaxonomyNode[] = aimarketTaxonomy,
  parentKey: string | null = null
): FlatTaxonomyNode[] {
  const out: FlatTaxonomyNode[] = [];

  for (const node of nodes) {
    out.push({ ...node, parentKey });
    if (node.children?.length) {
      out.push(...flattenTaxonomy(node.children, node.key));
    }
  }

  return out;
}

export const l1Categories = aimarketTaxonomy;

export const l2Categories = flattenTaxonomy().filter((item) => item.level === 2);

export const l3Categories = flattenTaxonomy().filter((item) => item.level === 3);

export function findCategoryBySlug(slug: string): TaxonomyNode | null {
  return flattenTaxonomy().find((item) => item.slug === slug) ?? null;
}
