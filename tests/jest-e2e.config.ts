// jest-e2e.config.ts
import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.', // Set root to the project root
  testEnvironment: 'node',
  testRegex: './test/.*\\.e2e-spec\\.ts$', // Only run files ending in .e2e-spec.ts
  transform: {
    '^.+.(t|j)s$': 'ts-jest',
  },
  setupFilesAfterEnv: ['<rootDir>/test/jest.setup.ts'],
  moduleNameMapper: {
    '^@nextgen/(.*)$': '<rootDir>/libs/$1/src',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};

export default config;
