import { defineConfig, globalIgnores } from 'eslint/config'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  globalIgnores([
    '.next/**',
    'coverage/**',
    'playwright-report/**',
    'supabase/**',
    'test-results/**',
  ]),
  {
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
])
