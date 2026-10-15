import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";

export const Route = createFileRoute("/empresas")({ component: Page });

function Page() {
  return (
    <>
      <SiteHeader />
      <main id="main" />
      <SiteFooter />
    </>
  );
}
