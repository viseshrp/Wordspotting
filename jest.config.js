module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  collectCoverage: true,
  collectCoverageFrom: [
    "js/utils.js",
    "js/settings.js"
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
