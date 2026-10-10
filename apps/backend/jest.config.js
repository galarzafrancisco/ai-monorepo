module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '../../',
  roots: ['<rootDir>/apps/backend/src', '<rootDir>/packages'],
  testMatch: ['<rootDir>/apps/backend/src/**/*.spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: {
        ...require('./tsconfig.json').compilerOptions,
        module: 'commonjs',
        moduleResolution: 'node',
        resolvePackageJsonExports: false,
        esModuleInterop: true,
      }
    }],
  },
  collectCoverageFrom: ['apps/backend/src/**/*.(t|j)s'],
  coverageDirectory: '<rootDir>/apps/backend/coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/apps/backend/src/$1',
  },
  // AI SDK and the shared workspace packages publish ESM. Transform them just
  // as the end-to-end Jest configuration does.
  transformIgnorePatterns: [],
};
