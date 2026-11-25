import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { loadSupabase } from "@/integrations/supabase/lazy";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const supabase = await loadSupabase();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => <Outlet />,
});