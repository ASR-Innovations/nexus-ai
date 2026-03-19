/**
 * Jest configuration for protocol execution property-based testing
 */

module.exports = {
  displayName: 'Protocol Execution Tests',
  testMatch: [
    '<rootDir>/src/agents/bot/**/*.property.test.ts',
    '<rootDir>/src/agents/bot/**/*.integration.test.ts'
  ],
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/src/agents/bot/testing/test-setup.ts'],
  collectCoverageFrom: [
    'src/agents/bot/**/*.ts',
    '!src/agents/bot/**/*.test.ts',
    '!src/agents/bot/**/*.spec.ts',
    '!src/agents/bot/testing/**/*.ts',
    '!src/agents/bot/interfaces/**/*.ts'
  ],
  coverageDirectory: '<rootDir>/coverage/protocol-execution',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 60000, // 60 seconds for property tests
  maxWorkers: 4,
  verbose: true,
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json'
    }
  }
};