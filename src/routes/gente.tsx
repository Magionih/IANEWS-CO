import { createFileRoute, redirect } from "@tanstack/react-router";

/* A seção "Gente" passou a se chamar "Protagonistas": o endereço antigo leva ao novo (301). */
export const Route = createFileRoute("/gente")({
  beforeLoad: () => {
    throw redirect({ to: "/protagonistas", statusCode: 301 });
  },
});
