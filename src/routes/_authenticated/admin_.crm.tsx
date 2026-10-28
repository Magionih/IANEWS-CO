import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { CrmProvider } from "@/components/crm/context";
import { CrmShell, SemAcesso } from "@/components/crm/shell";
import { Carregando } from "@/components/crm/ui";
import { getCrmContexto } from "@/lib/crm/core.functions";

/* /admin/crm: CRM interno. Só admin, comercial e editorial (o banco também bloqueia pela RLS). */

export const Route = createFileRoute("/_authenticated/admin_/crm")({
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
