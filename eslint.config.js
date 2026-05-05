import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'documentation/**',
      'docs/**',
      'examples/**',
      'data/**',
      'coverage/**',
      '.agentx/**',
      '.pnpm-store/**',
      '.stryker-tmp/**',
      'reports/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  // Não usamos sonarjs.configs.recommended (muito amplo — cognitive-complexity, deprecation,
  // slow-regex etc não são sobre dedup). Só ativamos as regras focadas em duplicação semântica:
  {
    plugins: { sonarjs },
    rules: {
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-identical-conditions': 'error',
      'sonarjs/no-identical-expressions': 'error',
      'sonarjs/no-duplicate-string': ['warn', { threshold: 5 }],
      'sonarjs/no-collapsible-if': 'warn',
      'sonarjs/no-redundant-jump': 'warn',
      'sonarjs/no-redundant-boolean': 'warn',
      'sonarjs/no-useless-catch': 'error',
      'sonarjs/no-inverted-boolean-check': 'warn',
    },
  },
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': 'warn',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/no-base-to-string': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-this-alias': 'warn',
      '@typescript-eslint/await-thenable': 'warn',
      '@typescript-eslint/prefer-promise-reject-errors': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      'require-yield': 'warn',
      'prefer-rest-params': 'warn',
      'no-control-regex': 'warn',
    },
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      // Literais repetidas em tests sao fixture data (IDs, mensagens mock, paths) —
      // extrair tudo pra constante nao ajuda legibilidade do teste.
      'sonarjs/no-duplicate-string': 'off',
    },
  },
  prettier,
);
