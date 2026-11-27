import { useCallback, useEffect, useState, type ComponentType } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeDollarSign,
  Bell,
  BellOff,
  BellRing,
  CheckCheck,
  FileText,
  Inbox,
  Loader2,
  Megaphone,
  Newspaper,
  Send,
  Share,
  SquarePlus,
  Sunrise,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  getAvisos,
  getPushConfig,
  marcarAvisosLidos,
  removerPush,
  salvarPush,
  testarPush,
  type Aviso,
} from "@/lib/crm/notificacoes.functions";
import { cn } from "@/lib/utils";

/* Sino de avisos (vendas, pautas, material, matéria no ar, resumos do dia) e ativação do push
   no celular. No iPhone o push só funciona com o CRM instalado na Tela de Início. */

const ICONE: Record<string, ComponentType<{ className?: string }>> = {
  venda: BadgeDollarSign,
  fechado: BadgeDollarSign,
  pauta: Inbox,
  contato: Megaphone,
  material: FileText,
  previa: FileText,
  publicada: Newspaper,
  resumo: Sunrise,
  teste: BellRing,
};

const TOM: Record<string, string> = {
  venda: "bg-emerald-50 text-emerald-700",
  fechado: "bg-emerald-50 text-emerald-700",
  pauta: "bg-[#EEF3FF] text-primary",
  contato: "bg-[#EEF3FF] text-primary",
  publicada: "bg-violet-50 text-violet-700",
  resumo: "bg-amber-50 text-amber-700",
};

function haQuanto(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `${d} dias`;
}

export function useAvisos() {
  const fetchAvisos = useServerFn(getAvisos);
  return useQuery({
    queryKey: ["crm", "avisos"],
    queryFn: () => fetchAvisos(),
    refetchInterval: 2 * 60_000,
    staleTime: 20_000,
  });
}

/** Botão do sino com o número de avisos não lidos; abre a lista. */
export function SinoAvisos({ className, claro }: { className?: string; claro?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const { data } = useAvisos();
  if (!data?.disponivel) return null;
  const n = data.naoLidos;
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label={n ? `Avisos: ${n} novos` : "Avisos"}
        className={cn(
          "relative flex h-10 w-10 items-center justify-center rounded-full transition",
          claro
            ? "text-nav-foreground active:bg-nav-hover"
            : "text-muted-foreground hover:bg-muted",
          className,
        )}
      >
        <Bell className="h-5 w-5" />
        {n ? (
          <span className="tabular absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#E5484D] px-1 text-[10px] font-bold text-white ring-2 ring-card">
            {n > 9 ? "9+" : n}
          </span>
        ) : null}
      </button>
      <ListaAvisos aberto={aberto} onFechar={() => setAberto(false)} itens={data.itens} />
    </>
  );
}

function ListaAvisos({
  aberto,
  onFechar,
  itens,
}: {
  aberto: boolean;
  onFechar: () => void;
  itens: Aviso[];
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const marcar = useServerFn(marcarAvisosLidos);
  const naoLidos = itens.filter((a) => !a.lido_em);

  const lerTodos = useCallback(async () => {
    await marcar({ data: {} });
    await qc.invalidateQueries({ queryKey: ["crm", "avisos"] });
  }, [marcar, qc]);

  const abrir = async (a: Aviso) => {
    onFechar();
    if (!a.lido_em) {
      void marcar({ data: { ids: [a.id] } }).then(() =>
        qc.invalidateQueries({ queryKey: ["crm", "avisos"] }),
      );
    }
    navigate({ to: a.url || "/" });
  };

  return (
    <Sheet open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[420px]">
        <div className="flex items-center justify-between gap-3 border-b px-5 pb-3.5 pr-12 pt-[calc(1rem+env(safe-area-inset-top))]">
          <div>
            <SheetTitle className="text-[16px]">Avisos</SheetTitle>
            <p className="text-[12.5px] text-muted-foreground">
              {naoLidos.length ? `${naoLidos.length} novos` : "Tudo lido"}
            </p>
          </div>
          {naoLidos.length ? (
            <Button variant="ghost" size="sm" className="h-8" onClick={lerTodos}>
              <CheckCheck className="h-4 w-4" /> Marcar como lidos
            </Button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {itens.length ? (
            <ul>
              {itens.map((a) => {
                const Icone = ICONE[a.tipo] ?? Bell;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => abrir(a)}
                      className={cn(
                        "flex w-full items-start gap-3 border-b border-[#EEF0F4] px-5 py-3.5 text-left transition hover:bg-[#F8FAFF]",
                        !a.lido_em && "bg-[#F7F9FF]",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]",
                          TOM[a.tipo] ?? "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icone className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span
                            className={cn(
                              "line-clamp-2 text-[13.5px] leading-snug",
                              a.lido_em ? "font-medium" : "font-semibold",
                            )}
                          >
                            {a.titulo}
                          </span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {haQuanto(a.criado_em)}
                          </span>
                        </span>
                        {a.corpo ? (
                          <span className="mt-0.5 line-clamp-2 text-[12.5px] text-muted-foreground">
                            {a.corpo}
                          </span>
                        ) : null}
                      </span>
                      {!a.lido_em ? (
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 px-8 py-16 text-center">
              <Bell className="h-7 w-7 text-muted-foreground" />
              <p className="text-[14px] font-semibold">Nenhum aviso ainda</p>
              <p className="text-[13px] text-muted-foreground">
                Vendas, pautas novas, material recebido e os resumos do dia aparecem aqui.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------- Push no celular ----------

function base64ParaBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesParaBase64(buf: ArrayBuffer | null) {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function ehIos() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
}

function instalado() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function nomeAparelho() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "Navegador";
}

/** Registra o service worker do CRM (só para receber as notificações). */
export function registrarServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
    /* sem service worker: o CRM funciona normalmente, só sem push */
  });
}

type EstadoPush =
  | { fase: "carregando" }
  | { fase: "indisponivel"; motivo: "navegador" | "instalar" | "banco" | "chave" }
  | { fase: "bloqueado" }
  | { fase: "desligado" }
  | { fase: "ligado"; endpoint: string };

export function usePush() {
  const fetchConfig = useServerFn(getPushConfig);
  const salvar = useServerFn(salvarPush);
  const remover = useServerFn(removerPush);
  const testar = useServerFn(testarPush);
  const [estado, setEstado] = useState<EstadoPush>({ fase: "carregando" });
  const [ocupado, setOcupado] = useState(false);
  const { data: config, refetch } = useQuery({
    queryKey: ["crm", "push-config"],
    queryFn: () => fetchConfig(),
    staleTime: 5 * 60_000,
  });

  const avaliar = useCallback(async () => {
    if (typeof window === "undefined") return;
    const suporta =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!suporta) {
      setEstado({
        fase: "indisponivel",
        motivo: ehIos() && !instalado() ? "instalar" : "navegador",
      });
      return;
    }
    if (ehIos() && !instalado()) return setEstado({ fase: "indisponivel", motivo: "instalar" });
    if (!config) return;
    if (!config.disponivel) return setEstado({ fase: "indisponivel", motivo: "banco" });
    if (Notification.permission === "denied") return setEstado({ fase: "bloqueado" });
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    setEstado(sub ? { fase: "ligado", endpoint: sub.endpoint } : { fase: "desligado" });
  }, [config]);

  useEffect(() => {
    void avaliar();
  }, [avaliar]);

  const ativar = async () => {
    setOcupado(true);
    try {
      const cfg = config?.vapid ? config : (await refetch()).data;
      if (!cfg?.vapid) {
        setEstado({ fase: "indisponivel", motivo: "chave" });
        toast.error("As notificações ainda estão sendo configuradas. Tente de novo em instantes.");
        return;
      }
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setEstado(permissao === "denied" ? { fase: "bloqueado" } : { fase: "desligado" });
        return;
      }
      registrarServiceWorker();
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64ParaBytes(cfg.vapid),
        }));
      await salvar({
        data: {
          endpoint: sub.endpoint,
          p256dh: bytesParaBase64(sub.getKey("p256dh")),
          auth: bytesParaBase64(sub.getKey("auth")),
          aparelho: nomeAparelho(),
        },
      });
      setEstado({ fase: "ligado", endpoint: sub.endpoint });
      toast.success("Notificações ligadas neste aparelho.");
      void testar().catch(() => undefined);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ligar as notificações.");
    } finally {
      setOcupado(false);
    }
  };

  const desativar = async () => {
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await remover({ data: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setEstado({ fase: "desligado" });
      toast.success("Notificações desligadas neste aparelho.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível desligar agora.");
    } finally {
      setOcupado(false);
    }
  };

  const enviarTeste = async () => {
    setOcupado(true);
    try {
      await testar();
      toast.success("Teste enviado. Chega em alguns segundos.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível testar agora.");
    } finally {
      setOcupado(false);
    }
  };

  return { estado, ocupado, ativar, desativar, enviarTeste };
}

/** Cartão para ligar as notificações (Configuração e Início). */
const CHAVE_DISPENSA = "crm:push-dispensado";
const DIAS_DISPENSA = 14;

function dispensadoRecente() {
  try {
    const t = Number(window.localStorage.getItem(CHAVE_DISPENSA) ?? 0);
    return Date.now() - t < DIAS_DISPENSA * 86_400_000;
  } catch {
    return false;
  }
}

export function CartaoNotificacoes({ compacto }: { compacto?: boolean }) {
  const { estado, ocupado, ativar, desativar, enviarTeste } = usePush();
  const [dispensado, setDispensado] = useState(() => (compacto ? dispensadoRecente() : false));
  if (estado.fase === "carregando") return null;
  if (compacto && (estado.fase === "ligado" || estado.fase === "indisponivel" || dispensado))
    return null;
  const dispensar = () => {
    try {
      window.localStorage.setItem(CHAVE_DISPENSA, String(Date.now()));
    } catch {
      /* sem armazenamento */
    }
    setDispensado(true);
  };

  const texto =
    estado.fase === "ligado"
      ? "Ligadas neste aparelho. Você recebe cada venda na hora e os pontos importantes às 8h, 12h30 e 18h30."
      : estado.fase === "bloqueado"
        ? "O aparelho bloqueou as notificações do CRM. Libere em Ajustes › Notificações › IA News CRM."
        : estado.fase === "indisponivel" && estado.motivo === "instalar"
          ? "No iPhone, instale o CRM na Tela de Início para receber notificações."
          : estado.fase === "indisponivel" && estado.motivo === "banco"
            ? "As notificações entram assim que a atualização do banco for aplicada."
            : estado.fase === "indisponivel"
              ? "Este navegador não recebe notificações. Use o app instalado no celular."
              : "Receba cada venda na hora e os pontos importantes do dia (8h, 12h30 e 18h30).";

  return (
    <section
      className={cn(
        "flex flex-wrap items-center gap-3.5 rounded-xl border bg-card px-4 py-3.5 sm:px-5",
        compacto && "border-primary/20 bg-[#F7F9FF]",
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px]",
          estado.fase === "ligado" ? "bg-emerald-50 text-emerald-700" : "bg-[#EEF3FF] text-primary",
        )}
      >
        {estado.fase === "ligado" ? (
          <BellRing className="h-5 w-5" />
        ) : estado.fase === "bloqueado" ? (
          <BellOff className="h-5 w-5" />
        ) : (
          <Bell className="h-5 w-5" />
        )}
      </span>
      <div className="min-w-0 flex-[1_1_220px]">
        <p className="text-[14px] font-semibold">Notificações no celular</p>
        <p className="text-[12.5px] text-muted-foreground">{texto}</p>
        {estado.fase === "indisponivel" && estado.motivo === "instalar" ? (
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Toque em <Share className="inline h-3.5 w-3.5 -translate-y-px text-primary" />{" "}
            Compartilhar e em{" "}
            <span className="whitespace-nowrap font-medium text-foreground">
              <SquarePlus className="inline h-3.5 w-3.5 -translate-y-px" /> Adicionar à Tela de
              Início
            </span>
            .
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {estado.fase === "desligado" ? (
          <Button className="h-9" onClick={ativar} disabled={ocupado}>
            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
            Ligar
          </Button>
        ) : null}
        {estado.fase === "ligado" ? (
          <>
            <Button variant="outline" className="h-9" onClick={enviarTeste} disabled={ocupado}>
              <Send className="h-4 w-4" /> Testar
            </Button>
            {!compacto ? (
              <Button variant="ghost" className="h-9" onClick={desativar} disabled={ocupado}>
                Desligar
              </Button>
            ) : null}
          </>
        ) : null}
        {compacto ? (
          <button
            type="button"
            onClick={dispensar}
            aria-label="Agora não"
            title="Agora não (lembra de novo em 14 dias)"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </section>
  );
}
