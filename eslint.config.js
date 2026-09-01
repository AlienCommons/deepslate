import stylistic from '@stylistic/eslint-plugin'
import tseslint from '@typescript-eslint/eslint-plugin'
import tseslintParser from '@typescript-eslint/parser'

export default [
	{
		ignores: ['**/dist', '**/lib', '**/node_modules'],
	},
	{
		files: ['**/*.ts'],
		languageOptions: {
			parser: tseslintParser,
			parserOptions: {
				project: './tsconfig-eslint.json',
				tsconfigRootDir: import.meta.dirname,
			},
		},
		plugins: {
			'@stylistic': stylistic,
			'@typescript-eslint': tseslint,
		},
		rules: {
			'@typescript-eslint/consistent-type-imports': [
				'warn',
				{ prefer: 'type-imports' },
			],
			'@typescript-eslint/prefer-readonly': 'warn',
			'@stylistic/quotes': ['warn', 'single', { avoidEscape: true }],
			'@stylistic/semi': ['warn', 'never'],
			'@stylistic/indent': ['warn', 'tab'],
			'@stylistic/member-delimiter-style': [
				'warn',
				{
					multiline: { delimiter: 'comma', requireLast: true },
					singleline: { delimiter: 'comma', requireLast: false },
					overrides: {
						interface: {
							multiline: { delimiter: 'none' },
						},
					},
				},
			],
			'@stylistic/comma-dangle': ['warn', 'always-multiline'],
			'@stylistic/eol-last': 'warn',
			'no-fallthrough': 'warn',
			'prefer-const': 'warn',
			'prefer-object-spread': 'warn',
			'@stylistic/quote-props': ['warn', 'as-needed'],
		},
	},
]
