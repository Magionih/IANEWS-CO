import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useAuth } from "@/hooks/use-auth";
import { getMyRoles } from "@/lib/admin.functions";

export function useAdminAccess() {
  const { isAuthenticated } = useAuth();
  const fetchRoles = useServerFn(getMyRoles);
  const { data } = useQuery({
    queryKey: ["my-roles"],
    queryFn: () => fetchRoles(),
    enabled: isAuthenticated,
    retry: false,
    staleTime: 60_000,
  });
  const roles = data?.roles ?? [];
  return {
    roles,
    isAdmin: !!data?.isAdmin,
    isEditor: !!data?.isEditor,
    /** Equipe do CRM interno: admin, comercial e editorial. */
    hasCrm: roles.some((r) => ["admin", "comercial", "editorial", "editor"].includes(r)),
  };
}
