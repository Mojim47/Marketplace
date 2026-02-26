module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  rules: {
    // TypeScript compiler performs symbol resolution; eslint no-undef is noisy on type-only names.
    "no-undef": "off",
  },
  ignorePatterns: [
    "**/dist/**",
    "**/.next/**",
    "**/coverage/**",
    "**/node_modules/**",
    "**/*.d.ts",
    "**/*.js",
  ],
};
