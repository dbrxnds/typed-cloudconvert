import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["opensrc/**"],
  },
  staged: {
    "*": "vp check --fix",
  },
  pack: {
    format: ["esm", "cjs"],
    dts: {
      tsgo: true,
      cjsReexport: true,
    },
    exports: true,
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
