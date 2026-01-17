module.exports = {
    testEnvironment: "jsdom",
    transform: {
        "^.+\\.js$": "babel-jest",
        ".+\\.css$": "<rootDir>/tests/css-stub.js"
    },
    setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
    collectCoverage: true,
    collectCoverageFrom: ["src/js/utils.js", "src/js/settings.js"],
    coverageThreshold: {
        global: {
            lines: 85,
            statements: 85,
            functions: 85,
            branches: 70
        }
    }
};
