import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import importX from 'eslint-plugin-import-x';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import svelteParser from 'svelte-eslint-parser';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	// ── Global ignores ──
	{
		ignores: [
			'node_modules/',
			'.svelte-kit/',
			'build/',
			'src-tauri/',
			'coverage/',
			'drizzle/',
			'scripts/',
			'server.js'
		]
	},

	// ── Base JS recommended ──
	js.configs.recommended,

	// ── TypeScript recommended ──
	...tseslint.configs.recommended,

	// ── Svelte recommended (includes a11y rules) ──
	...svelte.configs['flat/recommended'],

	// ── Global settings ──
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},

	// ── Svelte file parser ──
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parser: svelteParser,
			parserOptions: {
				parser: tseslint.parser
			}
		}
	},

	// ── .svelte.ts files need TypeScript parser + relaxed Svelte rules ──
	{
		files: ['**/*.svelte.ts'],
		languageOptions: {
			parser: tseslint.parser
		},
		rules: {
			'svelte/prefer-svelte-reactivity': 'off'
		}
	},

	// ── Stylistic formatting rules ──
	{
		plugins: {
			'@stylistic': stylistic
		},
		rules: {
			'@stylistic/indent': ['error', 'tab'],
			'@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
			'@stylistic/semi': ['error', 'always'],
			'@stylistic/comma-dangle': ['error', 'never'],
			'@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
			'@stylistic/comma-spacing': 'error',
			'@stylistic/key-spacing': 'error',
			'@stylistic/keyword-spacing': 'error',
			'@stylistic/space-before-blocks': 'error',
			'@stylistic/space-infix-ops': 'error',
			'@stylistic/arrow-spacing': 'error',
			'@stylistic/block-spacing': 'error',
			'@stylistic/object-curly-spacing': ['error', 'always'],
			'@stylistic/array-bracket-spacing': ['error', 'never'],
			'@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0 }],
			'@stylistic/no-trailing-spaces': 'error',
			'@stylistic/eol-last': ['error', 'always'],
			'@stylistic/space-before-function-paren': ['error', {
				anonymous: 'always',
				named: 'never',
				asyncArrow: 'always'
			}],
			'@stylistic/no-multi-spaces': 'error',
			'@stylistic/semi-spacing': 'error',
			'@stylistic/template-curly-spacing': ['error', 'never'],
			'@stylistic/type-annotation-spacing': 'error',
			'@stylistic/member-delimiter-style': ['error', {
				multiline: { delimiter: 'semi', requireLast: true },
				singleline: { delimiter: 'semi', requireLast: false }
			}]
		}
	},

	// ── Import ordering ──
	{
		plugins: {
			'import-x': importX
		},
		rules: {
			'import-x/order': ['error', {
				groups: [
					'builtin',
					'external',
					'internal',
					'parent',
					'sibling',
					'index',
					'type'
				],
				'newlines-between': 'never',
				alphabetize: { order: 'asc', caseInsensitive: true }
			}],
			'import-x/no-duplicates': 'error',
			'import-x/first': 'error',
			'import-x/newline-after-import': 'error'
		}
	},

	// ── Custom rule overrides ──
	{
		rules: {
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': ['error', {
				argsIgnorePattern: '^_',
				varsIgnorePattern: '^_',
				destructuredArrayIgnorePattern: '^_'
			}],
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/consistent-type-imports': ['error', {
				prefer: 'type-imports'
			}],
			'no-console': ['warn', { allow: ['warn', 'error'] }],
			'prefer-const': 'error',
			'no-var': 'error',
			'object-shorthand': 'error',
			'eqeqeq': ['error', 'always']
		}
	},

	// ── Svelte-specific overrides ──
	{
		files: ['**/*.svelte'],
		rules: {
			'@stylistic/indent': 'off',
			'svelte/indent': ['error', { indent: 'tab' }],
			'svelte/no-at-html-tags': 'warn',
			'svelte/no-navigation-without-resolve': 'off',
			'no-undef': 'off'
		}
	},

	// ── Test file relaxations ──
	{
		files: ['**/*.test.ts', '**/*.spec.ts'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'no-console': 'off'
		}
	}
);
