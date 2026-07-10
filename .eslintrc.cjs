module.exports = {
  root: true,
  env: { browser: true, es2023: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['@typescript-eslint', 'react-hooks'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  overrides: [
    {
      // These files read/write a `PlanoEngine` instance through a ref during render and in
      // effects — an intentional interop pattern with the imperative canvas engine, not the
      // "derive-state-in-render" or "React Compiler" anti-patterns react-hooks/refs and
      // react-hooks/immutability are meant to catch. Re-architecting this into synced state
      // would be a large rewrite of the app's most fragile surface for no behavioral gain.
      files: [
        'src/components/PdfViewer.tsx',
        'src/components/pdfViewer/TramoEditor.tsx',
        'src/components/pdfViewer/PdfViewerEngineInit.ts',
        'src/components/pdfViewer/DrawingElementContextMenu.tsx',
        'src/components/pdfViewer/CopyFromPlanPanel.tsx',
        'src/components/pdfViewer/AccesorioModal.tsx',
        'src/components/pdfViewer/BajanteAsociacion.tsx',
        'src/components/pdfViewer/ExtremeAccessoryEditor.tsx',
      ],
      rules: {
        'react-hooks/refs': 'off',
        'react-hooks/immutability': 'off',
        'react-hooks/set-state-in-effect': 'off',
      },
    },
  ],
  ignorePatterns: ['dist', 'node_modules', '*.config.*'],
};
