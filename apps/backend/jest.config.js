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
      }
    }],
  },
  collectCoverageFrom: ['apps/backend/src/**/*.(t|j)s'],
  coverageDirectory: '<rootDir>/apps/backend/coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/apps/backend/src/$1',
    '^@taico/errors$': '<rootDir>/packages/errors/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@modelcontextprotocol|@google/adk|jose|lodash-es|.*\\.mjs$))',
  ],
};
