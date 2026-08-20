import js from "@eslint/js";
import typescript from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import astro from "eslint-plugin-astro";
import jsx from "eslint-plugin-jsx-a11y";

export default [
  js.configs.recommended,
  ...astro.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "@typescript-eslint": typescript },
    languageOptions: { parser: typescriptParser },
    rules: typescript.configs.recommended.rules,
  },
  {
    files: ["**/*.{jsx,tsx,astro}"],
    plugins: { "jsx-a11y": jsx },
    rules: jsx.configs.recommended.rules,
  },
  {
    files: ["scripts/**/*.js"],
    languageOptions: {
      globals: {
        console: "readonly",
        fetch: "readonly",
        process: "readonly",
      },
    },
  },
  {
    files: ["public/scripts/**/*.js"],
    languageOptions: {
      globals: {
        document: "readonly",
      },
    },
  },
  {
    // These existing components intentionally expose browser/p5 callback names
    // and retain a few formatting helpers used by their inline renderers.
    files: [
      "src/components/AssignmentCard.astro",
      "src/components/P5Background.astro",
    ],
    plugins: { "@typescript-eslint": typescript },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", ".astro/**"],
  },
];
