import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "public/**",
    "scripts/**",
    "*.d.ts"
  ]),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "react/display-name": "off",
      "@next/next/no-img-element": "off"
    }
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "src/mocks/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
]);

export default eslintConfig;
