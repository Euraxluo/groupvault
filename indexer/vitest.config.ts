import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    server: {
      deps: {
        // Node's built-in SQLite module is experimental and Vite's resolver
        // strips the `node:` prefix unless it is treated as external.
        external: ["node:sqlite"],
      },
    },
  },
})
