import { createFileRoute } from "@tanstack/react-router";

// Diagnóstico: informa apenas SE cada configuração existe (nunca os valores).
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: () => {
        const has = (k: string) => Boolean(process.env[k] && String(process.env[k]).length > 0);
        return Response.json(
          {
            ok: true,
            config: {
              supabaseUrl: has("SUPABASE_URL"),
              supabaseServiceRole: has("SUPABASE_SERVICE_ROLE_KEY"),
              cronSecret: has("CRON_SECRET"),
              cronSecretLongEnough: (process.env.CRON_SECRET ?? "").length >= 16,
              aiKey: has("AI_API_KEY") || has("GEMINI_API_KEY"),
              resendKey: has("RESEND_API_KEY"),
              newsletterEnabled: process.env.NEWSLETTER_ENABLED === "true",
              vercelEnv: process.env.VERCEL_ENV ?? null,
              integrationConfig: has("POSTGRES_DATABASE"),
              integrationSecret: has("SUPABASE_JWT_SECRET"),
              emailFrom: has("EMAIL_FROM"),
              envCount: Object.keys(process.env).length,
            },
          },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
