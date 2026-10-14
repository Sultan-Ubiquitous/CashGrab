import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

const clientFiles = [
  'src/routes/**/*.{ts,tsx}',
  'src/components/**/*.{ts,tsx}',
  'src/lib/**/*.{ts,tsx}',
  'src/shared/**/*.{ts,tsx}',
]
const serverFiles = ['src/server/**/*.{ts,tsx}', 'scripts/**/*.{mjs,js}', 'tests/**/*.ts']

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      '.wrangler/**',
      '.output/**',
      'node_modules/**',
      'src/generated/**',
      'src/routeTree.gen.ts',
      'worker-configuration.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      curly: ['error', 'all'],
      'prefer-const': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  // Client code runs in the browser: no Node globals, and it must never
  // reach into the server tree (shared contracts live in ~/shared).
  {
    files: clientFiles,
    languageOptions: { globals: globals.browser },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['~/server/*', '../server/*', './server/*'],
              message: 'Client code must not import server modules; use ~/shared instead.',
            },
          ],
        },
      ],
    },
  },
  // Server, scripts and tests run on Node / the Workers runtime.
  {
    files: serverFiles,
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  prettier,
)
