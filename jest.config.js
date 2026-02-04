module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  testMatch: ["**/?(*.)+(spec|test).ts"],
  collectCoverage: true,
  collectCoverageFrom: [
    "entrypoints/shared/utils.ts",
    "entrypoints/shared/settings.ts"
  ],
  coverageThreshold: {
    global: {
      lines: 85,
      statements: 85,
      functions: 85,
      branches: 70
    }
  }
};
