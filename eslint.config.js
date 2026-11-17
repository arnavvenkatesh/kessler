import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '.vitest/**'],
  },
  {
    files: ['**/*.ts', '**/*.js'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['src/core/**/*.ts', 'src/core/**/*.js'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'DOM globals are forbidden inside src/core' },
        { name: 'document', message: 'DOM globals are forbidden inside src/core' },
        { name: 'HTMLElement', message: 'DOM globals are forbidden inside src/core' },
        { name: 'navigator', message: 'DOM globals are forbidden inside src/core' },
        { name: 'localStorage', message: 'Storage is forbidden inside src/core' },
        { name: 'sessionStorage', message: 'Storage is forbidden inside src/core' },
        { name: 'fetch', message: 'Network requests are forbidden inside src/core' },
        { name: 'setTimeout', message: 'Timers are forbidden inside src/core' },
        { name: 'setInterval', message: 'Timers are forbidden inside src/core' },
        { name: 'requestAnimationFrame', message: 'Animation frame is forbidden inside src/core' },
        { name: 'Date', message: 'Date is forbidden inside src/core; use deterministic seeds' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Math.random is forbidden inside src/core; use PRNG',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*', '@/app/*', '@/worker/*', '@/platform/*'],
              message: 'src/core is pure and must not import anything outside src/core',
            },
          ],
        },
      ],
    },
  },
);
