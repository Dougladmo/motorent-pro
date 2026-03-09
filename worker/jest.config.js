module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/integration/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  globals: { 'ts-jest': { tsconfig: { strict: true, esModuleInterop: true } } }
};
