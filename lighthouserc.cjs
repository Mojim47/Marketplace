module.exports = {
  ci: {
    collect: {
      url: [
        "http://localhost:3000/",
        "http://localhost:3000/checkout",
        "http://localhost:3000/profile",
        "http://localhost:3000/orders",
        "http://localhost:3003/login",
      ],
      numberOfRuns: 1,
      settings: {
        formFactor: "mobile",
        throttlingMethod: "provided",
        onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      },
      budgetsFilePath: "./lighthouse.budget.json",
    },
    assert: {
      assertions: {
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "categories:performance": ["error", { minScore: 0.9 }]
      },
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci"
    },
  },
};
