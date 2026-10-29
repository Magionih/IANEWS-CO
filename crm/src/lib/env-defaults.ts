// Valores públicos do Supabase embutidos no build (vêm do .env com prefixo VITE_).
// Garantem que o servidor funcione mesmo se a hospedagem não definir SUPABASE_URL /
// SUPABASE_PUBLISHABLE_KEY. Segredos (service role, Resend, IA, CRON) NUNCA vêm daqui.
export function applyEnvDefaults() {
  const defaults: Record<string, string | undefined> = {
    SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_PROJECT_ID: import.meta.env.VITE_SUPABASE_PROJECT_ID,
  };
  for (const [key, value] of Object.entries(defaults)) {
    if (value && !process.env[key]) process.env[key] = value;
  }
}
