/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NextGen Marketplace - next-sitemap Configuration
 * ═══════════════════════════════════════════════════════════════════════════
 * Purpose: Generate XML sitemap and robots.txt for SEO
 * Updates: Automatically on build
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://nextgen-marketplace.ir',
  generateRobotsTxt: true,
  generateIndexSitemap: true,

  // Sitemap generation options
  sitemapSize: 7000,
  changefreq: 'daily',
  priority: 0.7,

  // Exclude patterns
  exclude: [
    '/admin/*',
    '/api/*',
    '/dashboard/*',
    '/auth/*',
    '/checkout/success',
    '/checkout/cancel',
    '/_next/*',
    '/static/*',
  ],

  // Robots.txt configuration
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/api',
          '/dashboard',
          '/auth',
          '/checkout/success',
          '/checkout/cancel',
          '/_next',
          '/static',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        crawlDelay: 0,
      },
      {
        userAgent: 'Bingbot',
        allow: '/',
        crawlDelay: 0,
      },
    ],
    additionalSitemaps: [
      `${process.env.NEXT_PUBLIC_SITE_URL || 'https://nextgen-marketplace.ir'}/sitemap-products.xml`,
      `${process.env.NEXT_PUBLIC_SITE_URL || 'https://nextgen-marketplace.ir'}/sitemap-categories.xml`,
    ],
  },

  // Transform function for custom URLs
  transform: async (config, path) => {
    // Custom priority based on path
    let priority = config.priority;
    let changefreq = config.changefreq;

    if (path === '/') {
      priority = 1.0;
      changefreq = 'daily';
    } else if (path.startsWith('/products/')) {
      priority = 0.8;
      changefreq = 'weekly';
    } else if (path.startsWith('/categories/')) {
      priority = 0.7;
      changefreq = 'weekly';
    } else if (path.startsWith('/blog/')) {
      priority = 0.6;
      changefreq = 'monthly';
    }

    return {
      loc: path,
      changefreq,
      priority,
      lastmod: new Date().toISOString(),
      alternateRefs: [
        {
          href: `https://nextgen-marketplace.ir${path}`,
          hreflang: 'fa-IR',
        },
      ],
    };
  },
};
