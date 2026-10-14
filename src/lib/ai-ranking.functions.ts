import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

function serverClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export type AiTool = {
  id: string;
  slug: string;
  name: string;
  maker: string;
  category: string;
  website: string;
  icon: string;
  brand: string;
  about: string;
  context_window: string;
  pricing: string;
  released: string;
  pros: string[];
  cons: string[];
  scores: Record<string, number>;
  base_score: number;
  buzz_score: number;
  weekly_score: number;
  previous_score: number;
  rank_position: number;
  previous_position: number;
  ratings_count: number;
  ratings_avg: number;
  last_ranked_at: string | null;
};

const COLS =
  "id, slug, name, maker, category, website, icon, brand, about, context_window, pricing, released, pros, cons, scores, base_score, buzz_score, weekly_score, previous_score, rank_position, previous_position, ratings_count, ratings_avg, last_ranked_at";

function normalize(row: Record<string, unknown>): AiTool {
  return {
    ...(row as unknown as AiTool),
    scores: (row.scores ?? {}) as Record<string, number>,
    pros: (row.pros ?? []) as string[],
    cons: (row.cons ?? []) as string[],
    base_score: Number(row.base_score ?? 0),
    buzz_score: Number(row.buzz_score ?? 0),
    weekly_score: Number(row.weekly_score ?? 0),
    previous_score: Number(row.previous_score ?? 0),
    ratings_avg: Number(row.ratings_avg ?? 0),
  };
}

export const listAiTools = createServerFn({ method: "GET" }).handler(
  async (): Promise<AiTool[]> => {
    const supabase = serverClient();
    const { data, error } = await supabase
      .from("ai_tools")
      .select(COLS)
      .eq("is_active", true)
      .order("rank_position", { ascending: true })
      .limit(50);
    if (error) {
      console.error("[ai-ranking] list error", error);
      return [];
    }
    return (data ?? []).map((r) => normalize(r as Record<string, unknown>));
  },
);

export const getMyToolRatings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ai_tool_ratings")
      .select("tool_id, rating, use_case, comment")
      .eq("user_id", context.userId);
    if (error) {
      console.error("[ai-ranking] my ratings error", error);
      return [] as { tool_id: string; rating: number; use_case: string | null; comment: string | null }[];
    }
    return (data ?? []) as {
      tool_id: string;
      rating: number;
      use_case: string | null;
      comment: string | null;
    }[];
  });

export const rateAiTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { toolId: string; rating: number; useCase?: string; comment?: string }) => {
    if (!data?.toolId) throw new Error("Ferramenta inválida.");
    const rating = Math.round(Number(data.rating));
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      throw new Error("A nota deve ser de 1 a 5 estrelas.");
    }
    return {
      toolId: data.toolId,
      rating,
      useCase: (data.useCase ?? "").trim().slice(0, 120) || null,
      comment: (data.comment ?? "").trim().slice(0, 800) || null,
    };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ai_tool_ratings").upsert(
      {
        tool_id: data.toolId,
        user_id: context.userId,
        rating: data.rating,
        use_case: data.useCase,
        comment: data.comment,
      },
      { onConflict: "tool_id,user_id" },
    );
    if (error) {
      console.error("[ai-ranking] rate error", error);
      throw new Error("Não foi possível salvar sua avaliação. Tente novamente.");
    }
    return { ok: true };
  });
