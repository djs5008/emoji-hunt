const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    '!app/**/*.d.ts',
    '!app/**/layout.tsx',
    '!app/**/page.tsx',
    '!app/**/not-found.tsx',
  ],
  testMatch: [
    '<rootDir>/**/__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}',
    '<rootDir>/**/*.{test,spec}.{js,jsx,ts,tsx}',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  transformIgnorePatterns: [
    'node_modules/(?!(uncrypto|@upstash|nanoid|bad-words|badwords-list)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '@upstash/redis': '<rootDir>/app/__mocks__/@upstash/redis.ts',
    '^nanoid$': '<rootDir>/app/__mocks__/nanoid.ts',
    '^bad-words$': '<rootDir>/app/__mocks__/bad-words.ts',
  },
  testEnvironmentOptions: {
    url: 'http://localhost:3000',
  },
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)