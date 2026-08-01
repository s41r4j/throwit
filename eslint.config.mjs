import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["components/Throwit.tsx"],
    rules: {
      // Throwit manages WebRTC connections, polling timers, and mutable peer maps.
      // These lifecycle patterns are intentional and do not map cleanly to the
      // React Compiler's generic effect/memoization heuristics.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/exhaustive-deps": "off",
      "prefer-const": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "coverage/**", "next-env.d.ts"]),
]);
