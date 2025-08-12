// ESLint v9+ flat config with custom rules and ignores only

module.exports = [
  {
    ignores: [
      'migration/*',
      'public/*',
      'src/**/*.json',
      'core/node_modules/*',
      'core/**/prompts.js',
      'core/package.json',
      'core/package-lock.json',
      'node_modules/',
      'src/api/*/*.spec.js',
      'src/api/*/*.service.js',
      '*.log',
      'test/*',
      'yarn.lock',
      'test**.js',
      'public/**/*',
      'tests/*'
    ],
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
        sourceType: 'commonjs',
      globals: {
        _: true,
        util: true,
        i18n: true,
        Joi: true,
        container: true,
        dbConnection: true,
        Promise: true
      }
    },
    linterOptions: {
      reportUnusedDisableDirectives: true
    },
    rules: {
      indent: 'off',
      'linebreak-style': ['error', 'unix'],
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'always'],
      'no-unused-vars': [
        'error',
        {
          args: 'none',
          varsIgnorePattern: '^_$|^error$',
          caughtErrors: 'none'
        }
      ],
      'arrow-parens': ['error', 'always'],
      'no-prototype-builtins': 'off',
      'comma-dangle': ['error', 'never'],
      'no-useless-escape': 'off',
      'no-case-declarations': 'off',
      'no-control-regex': 'off',
      'no-useless-catch': 'off',
      'no-fallthrough': ['error', { allowEmptyCase: true }],
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
        { blankLine: 'any', prev: ['const', 'let', 'var'], next: ['const', 'let', 'var'] },
        { blankLine: 'always', prev: 'directive', next: '*' },
        { blankLine: 'any', prev: 'directive', next: 'directive' },
        { blankLine: 'always', prev: ['if', 'for', 'while', 'switch', 'try'], next: '*' },
        { blankLine: 'always', prev: '*', next: ['if', 'for', 'while', 'switch', 'try'] },
        { blankLine: 'always', prev: 'function', next: '*' },
        { blankLine: 'always', prev: '*', next: 'function' },
        { blankLine: 'always', prev: 'block-like', next: '*' },
        { blankLine: 'always', prev: ['case', 'default'], next: '*' },
        { blankLine: 'always', prev: '*', next: 'block-like' }
      ],
      'max-len': [
        'error',
        {
          code: 130,
          tabWidth: 4,
          ignoreTrailingComments: true
        }
      ],
      'no-self-compare': 'error',
      'default-case-last': 'error',
      'lines-between-class-members': ['error', 'always'],
      'object-shorthand': 'error',
      'no-useless-computed-key': 'error',
      'no-multi-assign': 'error',
      yoda: 'error',
      'no-var': 'error',
      'prefer-const': 'error'
    }
  }
]; 
