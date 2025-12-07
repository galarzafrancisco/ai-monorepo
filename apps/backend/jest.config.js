module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '../../',
  roots: ['<rootDir>/apps/backend/src', '<rootDir>/packages'],
  testMatch: ['<rootDir>/apps/backend/src/**/*.spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: {
        ...require('./tsconfig.json').compilerOptions,
        esModuleInterop: true,
      }
    }],
  },
  collectCoverageFrom: ['apps/backend/src/**/*.(t|j)s'],
  coverageDirectory: '<rootDir>/apps/backend/coverage',
  testEnvironment: 'node',
  transformIgnorePatterns: [
    'node_modules/(?!(@modelcontextprotocol|.*\\.mjs$))',
  ],
};
