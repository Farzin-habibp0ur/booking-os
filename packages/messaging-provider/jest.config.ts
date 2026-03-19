import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],
  moduleNameMapper: {
    '^@booking-os/shared$': '<rootDir>/../shared/src/index',
  },
};

export default config;
