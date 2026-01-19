module.exports = {
    testEnvironment: 'jsdom',
    transform: {
        '^.+\\.js$': 'babel-jest',
    },
    moduleNameMapper: {
        '\\.css$': '<rootDir>/tests/css-stub.js',
    },
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
};
