module.exports = {
  testEnvironment: 'jsdom',
  setupFiles: ['./tests/setup.js'],
  testMatch: ['**/tests/**/*.spec.js'],
  // Ignore src/ as it contains ES modules which Jest might struggle with if not transformed,
  // but we are testing assets/ which are CommonJS/Universal.
  transform: {}
};
