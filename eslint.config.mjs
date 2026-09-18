import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import importX from 'eslint-plugin-import-x';
import ts from 'typescript-eslint';

export default defineConfig({
  extends: [js.configs.recommended, ts.configs.recommended],
  plugins: {
    'import-x': importX,
  },
  rules: {
    'import-x/no-duplicates': 'error',
    'import-x/order': [
      'error',
      {
        alphabetize: { order: 'asc' },
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object'],
        'newlines-between': 'always',
        pathGroupsExcludedImportTypes: ['builtin'],
      },
    ],
    'no-undef': 'off',
  },
});
