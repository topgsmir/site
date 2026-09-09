import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/coverage/**",
      "apps/web/**"
    ]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["apps/api/src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "argsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_",
          "varsIgnorePattern": "^_"
        }
      ]
    }
  }
);
