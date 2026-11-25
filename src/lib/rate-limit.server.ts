/* Limite de envios por IP nos formulários públicos (contador no banco, função só do servidor).
   Se o banco falhar, deixa passar: o limite protege contra abuso, não pode derrubar o formulário. */
export function clientIp(request: Request): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "sem-ip"
  );
}

export async function rateLimited(
  request: Request,
  bucket: string,
  max: number,
  windowSeconds: number,
): Promise<Response | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any).rpc("hit_rate_limit", {
      p_key: `${bucket}:${clientIp(request)}`,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error || data !== false) return null;
  } catch {
    return null;
  }
  return Response.json(
    { ok: false, error: "Muitos envios em pouco tempo. Tente de novo em alguns minutos." },
    { status: 429, headers: { "Retry-After": String(windowSeconds) } },
  );
}
