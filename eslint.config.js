// Migración ESLint 8 (eslintrc) -> ESLint 9 (flat config), 2026-11-11.
// Equivalencia 1:1 con el .eslintrc.cjs anterior:
//   eslint:recommended                        -> js.configs.recommended
//   plugin:@typescript-eslint/recommended     -> typescript-eslint recommended (mismo nivel, sin type-checking)
//   plugin:react-hooks/recommended            -> configs.flat.recommended (mismas reglas + void-use-memo del preset flat)
//   plugin:jsx-a11y/recommended               -> flatConfigs.recommended
//   prettier                                  -> eslint-config-prettier (al final, como en extends)
//   env browser + es2023 / parserOptions      -> languageOptions con globals.browser + globals.es2023
//   overrides por globs                       -> objetos con `files`
import js from '@eslint/js';
import globals from 'globals';
import typescriptEslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';

export default [
  // Ignorados globales (antes: ignorePatterns). node_modules y dist van explícitos por claridad.
  { ignores: ['dist', 'node_modules', '*.config.*'] },

  // Presets base (mismo orden que el extends viejo).
  js.configs.recommended,
  ...typescriptEslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  jsxA11y.flatConfigs.recommended,
  prettier,

  // Entorno: equivalente a env { browser: true, es2023: true } + parserOptions del config viejo.
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2023 },
    },
  },

  // Reglas explícitas del config viejo (1:1).
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // Accesibilidad (ratchet 2026-11-11): el preset recommended ya las trae en 'error';
      // se fijan explícitas para que un cambio de preset no las baje sin que se note.
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/interactive-supports-focus': 'error',
      'jsx-a11y/label-has-associated-control': 'error',
      'jsx-a11y/no-noninteractive-element-interactions': 'error',
    },
  },

  // Override 1 del config viejo: interop intencional con el motor de canvas imperativo (PlanoEngine).
  // Se lee/escribe la instancia vía ref durante render y en effects; react-hooks/refs, immutability y
  // set-state-in-effect (reglas del React Compiler) marcarían el patrón como anti-pattern cuando no lo es.
  // Re-arquitecturar la superficie más frágil de la app no aporta ganancia de comportamiento.
  {
    files: [
      'src/modules/civilflow/components/PdfViewer.tsx',
      'src/modules/civilflow/components/pdfViewer/*.ts',
      'src/modules/civilflow/components/pdfViewer/*.tsx',
      'src/modules/civilflow/components/pdfViewer/drawingElementContextMenu/**/*.{ts,tsx}',
      'src/modules/civilflow/components/pdfViewer/tramoEditor/**/*.{ts,tsx}',
      'src/modules/civilflow/components/rci3d/*.{ts,tsx}',
      'src/modules/civilflow/components/rciNetwork3d/*.{ts,tsx}',
      'src/modules/civilflow/components/aparatos3d/*.{ts,tsx}',
      'src/modules/civilflow/components/epc3d/*.{ts,tsx}',
      'src/modules/civilflow/components/pdfViewer/CopyFromPlanPanel.tsx',
      'src/modules/civilflow/components/pdfViewer/BajanteAssociation.tsx',
      'src/modules/civilflow/components/pdfViewer/ExtremeAccessoryEditor.tsx',
      'src/modules/civilflow/components/workarea/PlanosTab.tsx',
      'src/modules/civilflow/components/FixturesPanel.tsx',
      'src/modules/civilflow/components/fixtures/**/*.{ts,tsx}',
    ],
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },

  // Override 2 del config viejo: console.log intencional en tests de regresión del motor CAD.
  {
    files: ['src/**/__tests__/**'],
    rules: { 'no-console': 'off' },
  },
];
