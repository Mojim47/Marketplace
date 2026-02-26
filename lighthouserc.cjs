const webPort = process.env.UI_WEB_PORT || '3000';
const adminPort = process.env.UI_ADMIN_PORT || '3003';

module.exports = {
  ci: {
    collect: {
      url: [
        `http://localhost:${webPort}/`,
        `http://localhost:${webPort}/categories`,
        `http://localhost:${webPort}/product/aimarket-ultra-5g`,
        `http://localhost:${webPort}/auth/login`,
        `http://localhost:${adminPort}/login`,
      ],
      numberOfRuns: 1,
      settings: {
        formFactor: 'mobile',
        throttlingMethod: 'provided',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      },
      budgetsFilePath: './lighthouse.budget.json',
    },
    assert: {
      assertions: {
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'categories:performance': ['error', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: '.lighthouseci',
    },
  },
};
