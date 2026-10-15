import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { SubscribeDialog } from "@/components/site/subscribe-dialog";
import { VisitTracker } from "@/components/site/visit-tracker";
import { ExitIntent } from "@/components/site/exit-intent";
import { PwaManager } from "@/components/site/pwa";
import { InstallPwaDialog } from "@/components/site/install-pwa-dialog";
import { ConsentBanner } from "@/components/site/consent-banner";
import { ScrollToTop } from "@/components/site/scroll-to-top";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
      },
      { name: "author", content: "IA News" },
      { name: "publisher", content: "IA News" },
      {
        name: "google-site-verification",
        content: "GksoToN9kvrTUh3RAFnEofLqCJ9BjNoq_MexBio_qu8",
      },
      { name: "theme-color", content: "#000000" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "IA News" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "mobile-web-app-capable", content: "yes" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "IA News" },
      { property: "og:locale", content: "pt_BR" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@ianews" },
    ],

    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href:
          "https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&family=Roboto+Mono:wght@400;500;600&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "NewsMediaOrganization",
              "@id": "https://ianewsbr.com/#organization",
              name: "IA News",
              alternateName: "IANews",
              url: "https://ianewsbr.com",
              logo: {
                "@type": "ImageObject",
                url: "https://ianewsbr.com/icon-512.png",
                width: 512,
                height: 512,
              },
              description:
                "Veículo brasileiro de jornalismo sobre inteligência artificial: notícias diárias, análises editoriais e o Ranking IA das melhores ferramentas de IA.",
              foundingDate: "2025",
              areaServed: "BR",
              knowsLanguage: "pt-BR",
              knowsAbout: [
                "Inteligência artificial",
                "IA generativa",
                "Regulamentação da IA no Brasil",
                "IA para empresas",
                "Ferramentas de IA",
              ],
              publishingPrinciples: "https://ianewsbr.com/sobre",
              sameAs: ["https://ianewsbr.com"],
            },
            {
              "@type": "WebSite",
              "@id": "https://ianewsbr.com/#website",
              url: "https://ianewsbr.com",
              name: "IA News",
              inLanguage: "pt-BR",
              publisher: { "@id": "https://ianewsbr.com/#organization" },
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: "https://ianewsbr.com/noticias?q={search_term_string}",
                },
                "query-input": "required name=search_term_string",
              },
            },
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify(
          [
            { name: "Notícias de IA", url: "https://ianewsbr.com/noticias" },
            { name: "Ranking IA", url: "https://ianewsbr.com/ranking" },
            { name: "Big Techs", url: "https://ianewsbr.com/categoria/bigtech" },
            { name: "IA no Brasil", url: "https://ianewsbr.com/categoria/brasil" },
            { name: "Regulação da IA", url: "https://ianewsbr.com/categoria/regulacao" },
            { name: "Ferramentas de IA", url: "https://ianewsbr.com/categoria/ferramentas" },
            { name: "IA para empresas", url: "https://ianewsbr.com/artigos/inteligencia-artificial-nas-empresas" },
            { name: "Newsletter", url: "https://ianewsbr.com/newsletter" },
            { name: "Sobre o IA News", url: "https://ianewsbr.com/sobre" },
          ].map((item, i) => ({
            "@context": "https://schema.org",
            "@type": "SiteNavigationElement",
            position: i + 1,
            name: item.name,
            url: item.url,
          })),
        ),
      },
    ],


  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <div className="app-shell">
        <Outlet />
      </div>
      <ScrollToTop />
      <VisitTracker />
      <SubscribeDialog />
      <ConsentBanner />
      <ExitIntent />
      <PwaManager />
      <InstallPwaDialog />

      <Toaster />
    </QueryClientProvider>
  );
}
