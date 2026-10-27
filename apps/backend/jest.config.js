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
        module: 'commonjs',
        moduleResolution: 'node',
        resolvePackageJsonExports: false,
        // The AI SDK ships ESM only, so its JavaScript is transformed too.
        allowJs: true,
      }
    }],
  },
  collectCoverageFrom: ['apps/backend/src/**/*.(t|j)s'],
  coverageDirectory: '<rootDir>/apps/backend/coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/apps/backend/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@modelcontextprotocol|ai/|@ai-sdk/|@workflow/|eventsource-parser/|.*\\.mjs$))',
  ],
};
