module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  verbose: true,
  // Garante que o processo encerre mesmo se algum timer com unref ficar pendente.
  forceExit: true
}
