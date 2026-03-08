module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js', '**/*.spec.ts', '**/*.test.ts'],
  rules: {
    'no-unused-vars': 'off',
    'no-undef': 'off',
    'no-unreachable': 'off',
  },
};