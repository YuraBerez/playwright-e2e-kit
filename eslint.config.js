import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    // Fixture apps have their own dependencies and build output; the e2e run leaves reports.
    ignores: ['dist/**', 'coverage/**', '**/node_modules/**', 'test/fixtures-apps/**', '**/test-results/**', '**/playwright-report/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.mjs', 'scripts/**', 'e2e/**'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly' } },
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      // The kit stays project-agnostic: it never reaches outside its own sources.
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['../*', '../../*'], message: 'The kit must not import from outside src/.' }] },
      ],
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
)
