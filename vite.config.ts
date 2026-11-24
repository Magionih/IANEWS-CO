// Configuração de build própria (sem dependências do Lovable).
// Gera o site para a Vercel via Nitro (preset "vercel").
import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

export default defineConfig(({ command, mode }) => {
  // Código de servidor (e-mails, cliente admin) usa variáveis sem prefixo VITE_.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

  const viteEnv = loadEnv(mode, process.cwd(), "VITE_");
  const define: Record<string, string> = {};
  for (const [key, value] of Object.entries(viteEnv)) {
    define[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  return {
    define,
    css: { transformer: "lightningcss" },
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "entities/lib/decode.js": path.resolve(import.meta.dirname, "node_modules/entities/lib/decode.js"),
        "entities/lib/encode.js": path.resolve(import.meta.dirname, "node_modules/entities/lib/encode.js"),
        entities: path.resolve(import.meta.dirname, "node_modules/entities"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
    server: { host: "::", port: 8080 },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        server: { entry: "server" },
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
      }),
      ...(command === "build" ? [nitro({
        preset: process.env.NITRO_PRESET || "vercel",
        vercel: { functions: { maxDuration: 300 } },
        // Cabeçalhos de segurança em todas as respostas.
        routeRules: {
          "/**": {
            headers: {
              "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
              "X-Content-Type-Options": "nosniff",
              "X-Frame-Options": "SAMEORIGIN",
              "Content-Security-Policy": "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; upgrade-insecure-requests",
              "Referrer-Policy": "strict-origin-when-cross-origin",
              "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(self), usb=(), interest-cohort=()",
              "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
            },
          },
          "/assets/**": { headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
        },
      } as never)] : []),
      viteReact(),
    ],
  };
});
