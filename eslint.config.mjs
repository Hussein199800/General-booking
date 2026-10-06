// @ts-check
import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Arabic script (incl. presentation forms). User-facing text belongs in locales/ar.json. */
const ARABIC = '[\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF]';

/** Physical-direction Tailwind utilities; RTL layouts must use logical ones (ms-, pe-, start-, text-start …). */
const PHYSICAL_DIRECTION_CLASS =
  '(^|\\s)(-?(ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br|scroll-ml|scroll-mr|scroll-pl|scroll-pr)-|text-left|text-right|float-left|float-right|clear-left|clear-right)';

const noArabicLiterals = [
  {
    selector: `Literal[value=/${ARABIC}/]`,
    message: 'Arabic text must live in locales/ar.json and be read through t().',
  },
  {
    selector: `TemplateElement[value.raw=/${ARABIC}/]`,
    message: 'Arabic text must live in locales/ar.json and be read through t().',
  },
  {
    selector: `JSXText[value=/${ARABIC}/]`,
    message: 'Arabic text must live in locales/ar.json and be read through t().',
  },
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/out/**',
      '**/coverage/**',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            '*.mjs',
            '*.js',
            'apps/*/*.mjs',
            'apps/web/*.ts',
            'apps/*/scripts/*.mjs',
            'scripts/*.mjs',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
    rules: {
      'no-restricted-syntax': ['error', ...noArabicLiterals],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['*.mjs', '*.js', 'scripts/*.mjs', 'apps/*/scripts/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // NestJS relies on decorated classes and constructor injection.
    files: ['apps/api/**/*.ts'],
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin },
    settings: { next: { rootDir: 'apps/web' } },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      'no-restricted-syntax': [
        'error',
        ...noArabicLiterals,
        {
          selector: `JSXAttribute[name.name='className'] Literal[value=/${PHYSICAL_DIRECTION_CLASS}/]`,
          message:
            'Use logical Tailwind utilities (ms-/me-/ps-/pe-/start-/end-/text-start/text-end) for RTL.',
        },
      ],
    },
  },
  prettier,
);
