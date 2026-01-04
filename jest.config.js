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
      lines: 90,
      statements: 90,
      functions: 90,
      branches: 80
    }
  }
};
