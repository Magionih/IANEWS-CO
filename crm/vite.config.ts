// CRM interno da IANews: app separado do portal (outro projeto na Vercel, outro domínio).
// Usa o mesmo banco Supabase do site; o acesso é controlado por papel (RLS) no banco.
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
      alias: { "@": path.resolve(import.meta.dirname, "src") },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
    server: { host: "::", port: 8081 },
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
      ...(command === "build"
        ? [nitro({ preset: process.env.NITRO_PRESET || "vercel", vercel: { functions: { maxDuration: 300 } } } as never)]
        : []),
      viteReact(),
    ],
  };
});
