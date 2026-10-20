import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig(
  globalIgnores(['out', 'dist', 'test-results', 'playwright-report']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    extends: [reactHooks.configs.flat['recommended-latest'], reactRefresh.configs.vite],
  },
  {
    files: [
      'src/main/**/*.ts',
      'src/preload/**/*.ts',
      'tests/**/*.ts',
      'scripts/**/*.mjs',
      '*.config.{ts,mts,mjs}',
    ],
    languageOptions: { globals: globals.node },
  },
  prettier,
)
