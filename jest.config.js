module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  collectCoverage: true,
  collectCoverageFrom: [
    "utils/**/*.ts",
    "entrypoints/**/*.ts",
    "!entrypoints/popup/main.ts",
    "!entrypoints/options/main.ts"
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^wxt/browser$": "<rootDir>/tests/wxtBrowserMock.ts",
    "\\.(css|less|scss|sass)$": "<rootDir>/tests/styleMock.js"
  },
  transform: {
    "^.+\\.tsx?$": "ts-jest"
  }
};
