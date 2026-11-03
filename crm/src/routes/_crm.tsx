import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { CrmProvider } from "@/components/crm/context";
import { useSessaoSegura } from "@/components/crm/sessao";
import { CrmShell, SemAcesso } from "@/components/crm/shell";
import { Carregando } from "@/components/crm/ui";
import { supabase } from "@/integrations/supabase/client";
import { getCrmContexto } from "@/lib/crm/core.functions";

/* CRM interno (site próprio). Só admin, comercial e editorial (o banco também bloqueia pela RLS). */

export const Route = createFileRoute("/_crm")({
  // Tudo roda só no navegador, com a sessão de quem entrou; sem sessão, vai para o login.
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Sessão local (sem ida ao servidor a cada troca de tela). O servidor confere o token em toda
    // consulta e o banco aplica a RLS; aqui só decide se mostra o CRM ou o login.
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/login", search: { volta: location.href } });
    }
    return { user: data.session.user };
  },
  head: () => ({
    meta: [
      { title: "CRM — IA News" },
      {
        name: "description",
        content:
          "CRM interno da IA News: empresas, pessoas, negócios, pautas, publicidade e audiência.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CrmLayout,
});

function CrmLayout() {
  useSessaoSegura();
  const fetchContexto = useServerFn(getCrmContexto);
  const { data, isLoading, error } = useQuery({
    queryKey: ["crm", "contexto"],
    queryFn: () => fetchContexto(),
    retry: false,
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Carregando texto="Abrindo o CRM..." />
      </div>
    );
  }
  if (error || !data)
    return <SemAcesso mensagem={error instanceof Error ? error.message : undefined} />;

  return (
    <CrmProvider valor={data}>
      <CrmShell>
        <Outlet />
      </CrmShell>
    </CrmProvider>
  );
}
