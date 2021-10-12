// eslint-disable-next-line no-undef
module.exports = {
    root: true, // By default ESLint keep looking for eslintrc up to root on filesystem, this is to stop it here
    parser: `@typescript-eslint/parser`, // Specifies the ESLint parser
    parserOptions: {
        // This setting is required if you want to use rules which require type information.
        // Relative paths are interpreted relative to the current working directory if tsconfigRootDir is not set.
        // If you intend on running ESLint from directories other than the project root, you should consider using tsconfigRootDir
        project: [`tsconfig.json`, `tsconfig.eslint.json`],
        ecmaVersion: 2020, // Allows for the parsing of modern ECMAScript features
        sourceType: `module`, // Allows for the use of imports
    },
    extends: [
        `eslint:recommended`,
        // Uses the recommended rules from the @typescript-eslint/eslint-plugin
        `plugin:@typescript-eslint/recommended`,
        // For larger codebases you may want to consider splitting our linting into two separate stages:
        // 1. fast feedback rules which operate purely based on syntax (no type-checking),
        // 2. rules which are based on semantics (type-checking).
        // See https://github.com/typescript-eslint/typescript-eslint/blob/master/docs/getting-started/linting/TYPED_LINTING.md
        `plugin:@typescript-eslint/recommended-requiring-type-checking`,
        // Enables eslint-plugin-prettier and eslint-config-prettier in one go.
        // Make sure this is always the last configuration in the extends array.
        // See https://github.com/prettier/eslint-config-prettier/blob/main/CHANGELOG.md#version-800-2021-02-21
        `plugin:prettier/recommended`,
    ],
    rules: {
        quotes: [`error`, `backtick`],
        "prefer-const": [`error`],
        // See https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/eslint-plugin/docs/rules/naming-convention.md
        "@typescript-eslint/naming-convention": [
            `error`,
            {
                selector: `variable`,
                format: [`snake_case`],
            },
            {
                selector: `variable`,
                modifiers: [`const`, `global`],
                types: [`boolean`, `string`, `number`],
                format: [`UPPER_CASE`],
            }, 
            {
                selector: `variable`,
                types: [`boolean`],
                format: [`snake_case`],
                prefix: [`is_`, `should_`, `has_`, `can_`, `did_`, `will_`],
            },
            {
                selector: `variable`,
                types: [`function`],
                format: [`camelCase`],
            },
            {
                selector: `typeLike`,
                format: [`PascalCase`],
            },
            {
                selector: `memberLike`,
                format: [`camelCase`, `snake_case`], // no type is allowed with memberLike so we include 2 cases here
                modifiers: [`private`],
                leadingUnderscore: `require`,
            },
            {
                selector: `parameter`,
                modifiers: [`unused`],
                format: null,
                leadingUnderscore: `require`,
                trailingUnderscore: `require`,
            },
            {
                selector: `parameter`,
                format: [`snake_case`],
            },
            {
                selector: `parameter`,
                types: [`function`],
                format: [`camelCase`],
            },
        ],
    },
};
