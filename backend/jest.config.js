module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/integration/**/*.test.ts', '**/__tests__/unit/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  setupFilesAfterFramework: [],
  globals: { 'ts-jest': { tsconfig: { strict: true, esModuleInterop: true } } }
};
