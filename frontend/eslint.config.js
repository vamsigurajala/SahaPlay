import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', caughtErrors: 'none' }],
      // Best-effort calls (localStorage, native plugins, media play()) are
      // deliberately wrapped in empty catch blocks throughout the app.
      'no-empty': ['error', { allowEmptyCatch: true }],
      // React Compiler advisory rules (new in eslint-plugin-react-hooks 6+).
      // This app doesn't use the React Compiler, and these flag long-standing,
      // working patterns, so they stay visible as warnings instead of errors.
      'react-hooks/static-components': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      // Dev-only hot-reload hint; these files intentionally export helpers too.
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
