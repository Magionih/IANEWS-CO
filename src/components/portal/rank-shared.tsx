import { useEffect, useMemo, useRef, useState } from "react";
import { Star } from "lucide-react";

import type { AiTool } from "@/lib/ai-ranking.functions";

/* Peças compartilhadas da página Ranking IA (visual do IANews Portal). */

export const AREAS = [
  { key: "semanal", label: "Ranking do dia" },
  { key: "geral", label: "Conhecimento Geral" },
  { key: "contabilidade", label: "Contabilidade" },
  { key: "juridico", label: "Jurídico" },
  { key: "literatura", label: "Literatura Brasileira" },
  { key: "medicina", label: "Medicina" },
  { key: "avaliacao", label: "Nota dos leitores" },
] as const;

export const CATEGORIES = [
  { key: "todas", label: "Todas as categorias" },
  { key: "chat", label: "Assistentes / Chat" },
  { key: "codigo", label: "Programação" },
  { key: "imagem", label: "Imagem" },
  { key: "video", label: "Vídeo" },
  { key: "audio", label: "Áudio e voz" },
  { key: "produtividade", label: "Produtividade" },
  { key: "negocios", label: "Negócios" },
  { key: "pesquisa", label: "Pesquisa" },
] as const;

const CAT_SHORT: Record<string, string> = {
  chat: "Chat",
  codigo: "Código",
  imagem: "Imagem",
  video: "Vídeo",
  audio: "Áudio",
  produtividade: "Produtividade",
  negocios: "Negócios",
  pesquisa: "Pesquisa",
};

export function catLabel(key: string) {
  return CAT_SHORT[key] ?? key;
}

export function scoreFor(tool: AiTool, area: string) {
  if (area === "semanal") return tool.weekly_score;
  if (area === "avaliacao") return tool.ratings_avg * 2;
  return tool.scores?.[area] ?? tool.base_score;
}

const NF = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function fmtScore(n: number) {
  return NF.format(Number.isFinite(n) ? n : 0);
}

function logoSources(m: AiTool) {
  const sources: string[] = [];
  if (m.icon) sources.push(`https://cdn.simpleicons.org/${m.icon}`);
  let host = "";
  try {
    host = new URL(m.website).hostname.replace(/^www\./, "");
  } catch {
    host = "";
  }
  if (host) {
    sources.push(`https://logo.clearbit.com/${host}`);
    sources.push(`https://www.google.com/s2/favicons?sz=128&domain=${host}`);
  }
  return sources;
}

/** Logomarca dentro do quadrado .logo-tile do protótipo, com fallback para a inicial. */
export function RankLogo({ m, className }: { m: AiTool; className?: string }) {
  const sources = useMemo(() => logoSources(m), [m.icon, m.website]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [m.id]);

  const src = sources[index];
  const imgRef = useRef<HTMLImageElement>(null);
  // Erros de imagem antes da hidratação não disparam onError: confere ao montar.
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth === 0) setIndex((i) => i + 1);
  }, [src]);
  return (
    <span className={"logo-tile" + (className ? " " + className : "")} aria-hidden="true">
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          width={24}
          height={24}
          className="rk-logo-img"
          ref={imgRef}
          onError={() => setIndex((i) => i + 1)}
          onLoad={(e) => {
            // ícone genérico de 16px do serviço de favicons = sem logo real
            if (e.currentTarget.naturalWidth <= 16) setIndex((i) => i + 1);
          }}
        />
      ) : (
        m.name
          .replace(/[^A-Za-zÀ-ú0-9]/g, "")
          .slice(0, 1)
          .toUpperCase()
      )}
    </span>
  );
}

export function Stars({
  value,
  onChange,
  size = 20,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
}) {
  return (
    <span className="rk-stars">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        const star = (
          <Star
            className={filled ? "on" : undefined}
            style={{ width: size, height: size }}
            aria-hidden="true"
          />
        );
        return onChange ? (
          <button
            key={n}
            type="button"
            aria-label={`Dar nota ${n}`}
            aria-pressed={filled}
            onClick={() => onChange(n)}
          >
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </span>
  );
}

/** Variação de posição em relação ao dia anterior. */
export function TrendBadge({ tool }: { tool: AiTool }) {
  const delta = tool.previous_position > 0 ? tool.previous_position - tool.rank_position : 0;
  if (delta === 0) {
    return (
      <span className="rk-delta" title="Mesma posição de ontem">
        = estável
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span
      className={"rk-delta " + (up ? "up" : "down")}
      title={up ? `Subiu ${delta} posições desde ontem` : `Caiu ${-delta} posições desde ontem`}
    >
      {up ? "▲" : "▼"} {Math.abs(delta)}
    </span>
  );
}
