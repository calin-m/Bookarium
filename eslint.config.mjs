import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import bookariumSecurity from "./scripts/eslint-rules/bookarium-security.js";

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
    plugins: {
      "bookarium-security": bookariumSecurity
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "react/display-name": "off",
      "@next/next/no-img-element": "off",
      "bookarium-security/no-unsafe-fetch": "error",
      "bookarium-security/no-unvalidated-redirect": "error",
      "bookarium-security/no-client-server-boundary-violation": "error",
      "bookarium-security/no-dangerous-execution": "error",
      "bookarium-security/no-unsafe-dom-injection": "error",
      "bookarium-security/no-tainted-request-sink": "error",
      "bookarium-security/no-secret-env-or-public-route-leak": "error",
      "bookarium-security/no-focused-or-tautological-tests": "error",
      "bookarium-security/enforce-gutenberg-and-copyright-policy": "error"
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
