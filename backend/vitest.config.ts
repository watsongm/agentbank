import { defineConfig } from "vitest/config";

// Explicit backend vitest config so it does NOT walk up the tree and
// pick up the frontend's vite.config.js (which loads @vitejs/plugin-react
// and breaks the backend test run).
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 15_000,
    hookTimeout: 15_000,
    globals: false,
  },
  resolve: {
    // Allow tests to import "../src/server.js" and resolve to server.ts
    extensions: [".ts", ".js", ".mjs", ".json"],
  },
});
