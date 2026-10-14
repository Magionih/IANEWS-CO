import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { IngestInput, IngestOutcome } from "@/lib/ingest-topics";

export type { IngestInput, IngestOutcome } from "@/lib/ingest-topics";
export { INGEST_TOPICS } from "@/lib/ingest-topics";

export const refreshNews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Partial<IngestInput> | undefined) => input ?? {})
  .handler(async ({ data: input, context }): Promise<IngestOutcome> => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const roles = ((data ?? []) as { role: string }[]).map((r) => r.role);
    if (!roles.includes("admin") && !roles.includes("editor")) {
      throw new Error("Acesso restrito a administradores.");
    }
    try {
      const { runNewsIngest, TOPIC_KEYS } = await import("@/lib/news-ingest.server");
      const topics = ((input.topics ?? []) as string[]).filter((t) =>
        (TOPIC_KEYS as readonly string[]).includes(t),
      ) as (typeof TOPIC_KEYS)[number][];
      const result = await runNewsIngest({
        limit: input.limit ?? 8,
        hours: input.hours ?? 24,
        minWords: input.minWords ?? 80,
        requireImage: input.requireImage ?? false,
        topics,
      });
      return { ok: true, ...result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[ingest] falhou:", message);
      return { ok: false, imported: 0, skipped: 0, errors: [message], message };
    }
  });
