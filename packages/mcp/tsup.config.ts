import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: "es2022",
  outDir: "dist",
  banner: {
    js: "#!/usr/bin/env node",
  },
  external: ["@modelcontextprotocol/sdk", "@turtlexyz/sdk", "zod"],
});
