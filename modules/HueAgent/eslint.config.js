// ESLint v9 flat config
module.exports = [
  {
    ignores: ["node_modules/**", "dist/**", "coverage/**", ".eslintrc.json", ".eslintignore"],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        console: "readonly",
        require: "readonly",
        module: "readonly",
        process: "readonly",
        __dirname: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { args: "after-used", argsIgnorePattern: "^_" }],
      "no-undef": "error",
      "no-console": "off",
    },
  },
  {
    files: ["test/**/*.js"],
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        before: "readonly",
        after: "readonly",
      },
    },
  },
];