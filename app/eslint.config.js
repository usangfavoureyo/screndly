import js from '@eslint/js';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    // Ignore patterns
    {
        ignores: [
            'build/**',
            'dist/**',
            'node_modules/**',
            '*.config.js',
            '*.config.ts',
            'vite.config.ts',
            'src/tests/**',
            'src/public/**',
        ],
    },

    // Base JS recommended rules
    js.configs.recommended,

    // TypeScript rules
    ...tseslint.configs.recommended,

    // React configuration
    {
        files: ['**/*.{ts,tsx}'],
        plugins: {
            react: reactPlugin,
            'react-hooks': reactHooksPlugin,
            'unused-imports': unusedImports,
        },
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.es2022,
            },
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
        rules: {
            // React rules
            'react/react-in-jsx-scope': 'off',
            'react/prop-types': 'off',
            'react/jsx-uses-react': 'off',
            'react/jsx-uses-vars': 'error',

            // React Hooks rules
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'off', // Too many false positives

            // Unused imports - AUTO-FIXABLE (strict on imports only)
            '@typescript-eslint/no-unused-vars': 'off',
            'unused-imports/no-unused-imports': 'error', // Auto-fixable!
            'unused-imports/no-unused-vars': 'off', // Too noisy for now

            // TypeScript rules - relaxed
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-empty-object-type': 'off',
            '@typescript-eslint/no-unused-expressions': 'off',
            '@typescript-eslint/no-unsafe-function-type': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/ban-ts-comment': 'off',

            // General rules - relaxed
            'no-console': 'off',
            'no-debugger': 'warn',
            'prefer-const': 'off',
            'no-var': 'error',
            'no-case-declarations': 'off',
            'no-prototype-builtins': 'off',
            'no-useless-escape': 'off',
            'no-empty': 'off',
        },
    },
);
