import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'legacy/**', 'next-env.d.ts', 'data/**'] },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // The AI layer and the deterministic engines must never take an untyped value.
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
];

export default config;
