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
  // CommonJS Jest cannot load the AI SDK's ESM entry points or the ESM shared
  // workspace packages directly. Their transitive dependencies also include
  // ESM, so intentionally transform the full dependency graph (as E2E does)
  // rather than maintaining an incomplete allowlist. Jest caches transforms.
  transformIgnorePatterns: [],
};
