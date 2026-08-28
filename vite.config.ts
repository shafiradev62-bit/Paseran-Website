// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// The TanStack devtools Vite plugin injects `data-tsd-source="file:line:col"` attributes into
// every JSX element for its "Go to Source" feature. React-Three-Fiber treats the dashed name as a
// pierced prop path (`data.tsd-source`) and throws "R3F: Cannot set data-tsd-source", crashing the
// 3D scene. This plugin strips that dev-only attribute from any module that uses R3F so the scene
// renders. DOM-only files keep the attribute (inspect feature unaffected).
function stripR3FDevtoolsSource() {
  const attr = / data-tsd-source="[^"]*"/g;
  return {
    name: "strip-r3f-devtools-source",
    enforce: "pre" as const,
    transform(code: string, id: string) {
      if (id.includes("node_modules")) return null;
      if (!/@react-three/.test(code)) return null;
      if (!attr.test(code)) return null;
      attr.lastIndex = 0;
      return { code: code.replace(attr, ""), map: null };
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [stripR3FDevtoolsSource()],
    // Pre-bundle the heavy 3D stack at server start (one time, cached) instead of
    // on the first page request, so opening localhost is fast. lucide-react is
    // excluded so it is served tree-shaken per-icon rather than as one giant blob.
    optimizeDeps: {
      include: [
        "three",
        "@react-three/fiber",
        "@react-three/drei",
        "lucide-react",
      ],
    },
  },
});
