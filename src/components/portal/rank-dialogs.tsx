import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ExternalLink,
  GitCompare,
  Trophy,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PortalSubscribeForm, useSubscribed } from "@/components/site/portal-subscribe";
import { rateAiTool, type AiTool } from "@/lib/ai-ranking.functions";
import { AREAS, RankLogo, Stars, TrendBadge, catLabel, fmtScore, scoreFor } from "./rank-shared";

/* Diálogos da página Ranking IA: ficha da ferramenta, comparação lado a lado e avaliação do leitor.
   Folha inferior no celular, janela central no computador, com rolagem interna e fechar sempre visível. */

function Sheet({
  open,
  onClose,
  title,
  description,
  wide,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="rkd-bg" />
        <DialogPrimitive.Content
          className={"rkd" + (wide ? " wide" : "")}
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="sr-only">
              {description}
            </DialogPrimitive.Description>
          ) : null}
          <span className="rkd-grab" aria-hidden="true" />
          <DialogPrimitive.Close className="rkd-x" aria-label="Fechar">
            <X aria-hidden="true" />
          </DialogPrimitive.Close>
          <div className="rkd-scroll">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

const readers = (t: AiTool) =>
  t.ratings_count > 0 ? `${t.ratings_avg.toFixed(1).replace(".", ",")}/5` : "—";

/* ---------- Comparação ---------- */
type Row = {
  label: string;
  value: (t: AiTool) => string;
  /** número para destacar o melhor; maior é melhor, salvo "lower". */
  num?: (t: AiTool) => number | null;
  lower?: boolean;
  text?: boolean;
};

const ROWS: Row[] = [
  {
    label: "Posição no ranking",
    value: (t) => `${t.rank_position}º`,
    num: (t) => t.rank_position,
    lower: true,
  },
  { label: "Nota técnica", value: (t) => fmtScore(t.base_score), num: (t) => t.base_score },
  {
    label: "Repercussão nas notícias",
    value: (t) => `${Math.round(t.buzz_score)} pts`,
    num: (t) => t.buzz_score,
  },
  {
    label: "Nota dos leitores",
    value: (t) => (t.ratings_count > 0 ? `${readers(t)} (${t.ratings_count})` : "Sem notas"),
    num: (t) => (t.ratings_count > 0 ? t.ratings_avg : null),
  },
  ...AREAS.filter((a) => a.key !== "semanal" && a.key !== "avaliacao").map((a) => ({
    label: a.label,
    value: (t: AiTool) => fmtScore(scoreFor(t, a.key)),
    num: (t: AiTool) => scoreFor(t, a.key),
  })),
  { label: "Contexto", value: (t) => t.context_window || "—", text: true },
  { label: "Preço", value: (t) => t.pricing || "—", text: true },
  { label: "Ponto forte", value: (t) => t.pros[0] ?? "—", text: true },
  { label: "Ponto de atenção", value: (t) => t.cons[0] ?? "—", text: true },
];

function bestIndex(tools: AiTool[], r: Row): number {
  if (!r.num) return -1;
  let best = -1;
  let bestVal: number | null = null;
  tools.forEach((t, i) => {
    const v = r.num!(t);
    if (v == null || !Number.isFinite(v)) return;
    if (bestVal == null || (r.lower ? v < bestVal : v > bestVal)) {
      bestVal = v;
      best = i;
    }
  });
  // Empate não destaca ninguém.
  const ties = tools.filter((t) => r.num!(t) === bestVal).length;
  return ties > 1 ? -1 : best;
}

export function CompareDialog({
  tools,
  open,
  onClose,
  onClear,
  onOpenTool,
}: {
  tools: AiTool[];
  open: boolean;
  onClose: () => void;
  onClear: () => void;
  onOpenTool?: (t: AiTool) => void;
}) {
  const subscribed = useSubscribed();
  const winner = tools.length
    ? tools.reduce((a, b) => (b.weekly_score > a.weekly_score ? b : a), tools[0])
    : null;
  const cols = { ["--n" as string]: String(Math.max(1, tools.length)) };

  return (
    <Sheet open={open} onClose={onClose} title="Comparar ferramentas" wide>
      <div className="rkc">
        <p className="kick">Ranking IA · comparação</p>
        <h2 className="rkc-t">Lado a lado</h2>

        <div className="rkc-heads" style={cols}>
          {tools.map((t) => (
            <button
              key={t.id}
              type="button"
              className={"rkc-head" + (winner?.id === t.id ? " win" : "")}
              onClick={() => onOpenTool?.(t)}
            >
              {winner?.id === t.id ? (
                <span className="rkc-crown">
                  <Trophy aria-hidden="true" /> Melhor nota
                </span>
              ) : null}
              <RankLogo m={t} className="rkc-logo" />
              <b>{t.name}</b>
              <span className="rkc-mk">{t.maker}</span>
              <span className="rkc-sc num">
                {fmtScore(t.weekly_score)}
                <small>/10</small>
              </span>
            </button>
          ))}
        </div>

        <div className="rkc-rows">
          {ROWS.map((r) => {
            const best = bestIndex(tools, r);
            return (
              <div key={r.label} className={"rkc-row" + (r.text ? " text" : "")}>
                <span className="rkc-lb">{r.label}</span>
                <div className="rkc-vals" style={cols}>
                  {tools.map((t, i) => (
                    <span key={t.id} className={i === best ? "best" : undefined}>
                      {i === best ? <Check className="rkc-ok" aria-label="Melhor" /> : null}
                      {r.value(t)}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {!subscribed ? (
          <div className="rk-dlg-band">
            <p>
              <b>Receba o comparativo toda semana.</b> Toda segunda, o ranking das plataformas de IA
              e o que mudou.
            </p>
            <PortalSubscribeForm placement="ranking-band" button="Receber grátis" />
          </div>
        ) : null}

        <div className="rkc-foot">
          <button type="button" onClick={onClear} className="btn line s">
            Limpar comparação
          </button>
          <button type="button" onClick={onClose} className="btn s">
            Voltar ao ranking
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------- Avaliação ---------- */
function RatingForm({
  tool,
  initial,
  isAuthenticated,
  onSaved,
}: {
  tool: AiTool;
  initial: { rating: number; use_case: string | null; comment: string | null } | null;
  isAuthenticated: boolean;
  onSaved: () => void;
}) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [useCase, setUseCase] = useState(initial?.use_case ?? "");
  const [comment, setComment] = useState(initial?.comment ?? "");

  useEffect(() => {
    setRating(initial?.rating ?? 0);
    setUseCase(initial?.use_case ?? "");
    setComment(initial?.comment ?? "");
  }, [initial, tool.id]);

  const rate = useServerFn(rateAiTool);
  const mutation = useMutation({
    mutationFn: (vars: { toolId: string; rating: number; useCase: string; comment: string }) =>
      rate({ data: vars }),
    onSuccess: () => {
      toast.success("Avaliação registrada. Obrigado!");
      onSaved();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao avaliar."),
  });

  if (!isAuthenticated) {
    return (
      <div className="rk-rate">
        <b>Você usa o {tool.name}?</b>
        <p className="fine">
          Entre na sua conta IA News para dar sua nota. Ela conta no ranking de amanhã.
        </p>
        <div>
          <Link to="/auth" className="btn s">
            Entrar ou criar conta
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rk-rate">
      <b>Sua avaliação</b>
      <Stars value={rating} onChange={setRating} />
      <input
        className="field"
        value={useCase}
        onChange={(e) => setUseCase(e.target.value)}
        placeholder="Para que você usa? (ex.: atendimento, contabilidade)"
        aria-label="Para que você usa"
        maxLength={120}
      />
      <textarea
        className="field"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Conte sua experiência (opcional)"
        aria-label="Sua experiência"
        maxLength={800}
        rows={3}
      />
      <button
        type="button"
        className="btn blue"
        disabled={rating < 1 || mutation.isPending}
        onClick={() => mutation.mutate({ toolId: tool.id, rating, useCase, comment })}
      >
        {mutation.isPending ? "Enviando..." : initial ? "Atualizar avaliação" : "Enviar avaliação"}
      </button>
    </div>
  );
}

/* ---------- Ficha da ferramenta ---------- */
export function ToolDialog({
  tool,
  activeArea,
  activeLabel,
  myRating,
  isAuthenticated,
  inCompare,
  onCompare,
  onClose,
  onSaved,
}: {
  tool: AiTool | null;
  activeArea: string;
  activeLabel: string;
  myRating: { rating: number; use_case: string | null; comment: string | null } | null;
  isAuthenticated: boolean;
  inCompare?: boolean;
  onCompare?: (t: AiTool) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [last, setLast] = useState<AiTool | null>(tool);
  useEffect(() => {
    if (tool) setLast(tool);
  }, [tool]);
  const t = tool ?? last;

  return (
    <Sheet open={!!tool} onClose={onClose} title={t?.name ?? "Ferramenta"}>
      {t ? (
        <div className="rkt">
          <div className="rkt-hero">
            <RankLogo m={t} className="rkt-logo" />
            <div className="rkt-id">
              <p className="rkt-pos">
                <span>{t.rank_position}º no Ranking IA</span>
                <TrendBadge tool={t} />
              </p>
              <h2>{t.name}</h2>
              <p className="rkt-mk">
                {t.maker} · {catLabel(t.category)}
                {t.released ? ` · desde ${t.released}` : ""}
              </p>
            </div>
            <div
              className="rkt-score num"
              aria-label={`Nota do dia ${fmtScore(t.weekly_score)} de 10`}
            >
              {fmtScore(t.weekly_score)}
              <small>nota do dia</small>
            </div>
          </div>

          {t.about ? <p className="rkt-about">{t.about}</p> : null}

          <div className="rkt-stats">
            <div>
              <span>Nota técnica</span>
              <b className="num">{fmtScore(t.base_score)}</b>
            </div>
            <div>
              <span>Repercussão</span>
              <b className="num">{Math.round(t.buzz_score)} pts</b>
            </div>
            <div>
              <span>Leitores</span>
              <b className="num">{t.ratings_count > 0 ? readers(t) : "—"}</b>
              {t.ratings_count > 0 ? <em>{t.ratings_count} notas</em> : <em>seja o primeiro</em>}
            </div>
          </div>

          <div className="rkt-block">
            <p className="rk-lb">Nota por área</p>
            <div className="rkt-areas">
              {AREAS.filter((a) => a.key !== "semanal" && a.key !== "avaliacao").map((a) => {
                const v = scoreFor(t, a.key);
                return (
                  <div key={a.key} className={"rkt-area" + (a.key === activeArea ? " on" : "")}>
                    <span>{a.label}</span>
                    <span className="rkt-bar" aria-hidden="true">
                      <i style={{ width: `${Math.max(0, Math.min(100, v * 10))}%` }} />
                    </span>
                    <b className="num">{fmtScore(v)}</b>
                  </div>
                );
              })}
            </div>
            <p className="sr-only">Área em destaque: {activeLabel}</p>
          </div>

          {t.pros.length || t.cons.length ? (
            <div className="rkt-pc">
              {t.pros.length ? (
                <div className="good">
                  <p className="rk-lb">Pontos fortes</p>
                  <ul>
                    {t.pros.map((p) => (
                      <li key={p}>
                        <CheckCircle2 aria-hidden="true" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {t.cons.length ? (
                <div className="warn">
                  <p className="rk-lb">Pontos de atenção</p>
                  <ul>
                    {t.cons.map((c) => (
                      <li key={c}>
                        <AlertTriangle aria-hidden="true" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {t.pricing || t.context_window ? (
            <dl className="rkt-facts">
              {t.pricing ? (
                <div>
                  <dt>Preço</dt>
                  <dd>{t.pricing}</dd>
                </div>
              ) : null}
              {t.context_window ? (
                <div>
                  <dt>Contexto</dt>
                  <dd>{t.context_window}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          <div className="rkt-actions">
            {t.website ? (
              <a href={t.website} target="_blank" rel="noreferrer noopener" className="btn blue">
                Visitar {t.name} <ExternalLink className="ico" aria-hidden="true" />
              </a>
            ) : null}
            {onCompare ? (
              <button type="button" className="btn line" onClick={() => onCompare(t)}>
                <GitCompare className="ico" aria-hidden="true" />
                {inCompare ? "Na comparação" : "Comparar"}
              </button>
            ) : null}
          </div>

          <RatingForm
            tool={t}
            initial={myRating}
            isAuthenticated={isAuthenticated}
            onSaved={onSaved}
          />
        </div>
      ) : null}
    </Sheet>
  );
}

/* ---------- Voto do leitor ---------- */
export function RatingPrompt({
  open,
  tools,
  isAuthenticated,
  onClose,
  onDone,
}: {
  open: boolean;
  tools: AiTool[];
  isAuthenticated: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [toolId, setToolId] = useState("");
  const [rating, setRating] = useState(0);
  const rate = useServerFn(rateAiTool);
  const mutation = useMutation({
    mutationFn: (vars: { toolId: string; rating: number }) => rate({ data: vars }),
    onSuccess: () => {
      toast.success("Obrigado! Sua nota já conta para o ranking de amanhã.");
      onDone();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao avaliar."),
  });

  return (
    <Sheet open={open} onClose={onClose} title="Qual IA você mais usa?">
      <div className="rkt">
        <p className="kick">Voto do leitor</p>
        <h2 className="rkc-t">Qual IA você mais usa?</h2>
        <p className="rkt-about">
          Leva 10 segundos. Sua nota entra no cálculo do ranking de amanhã.
        </p>
        {isAuthenticated ? (
          <div className="rk-rate plain">
            <select
              value={toolId}
              onChange={(e) => setToolId(e.target.value)}
              className="field"
              aria-label="Escolha a ferramenta que mais usa"
            >
              <option value="">Selecione a ferramenta…</option>
              {[...tools]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.maker}
                  </option>
                ))}
            </select>
            <div className="rk-stars-c">
              <Stars value={rating} onChange={setRating} size={30} />
            </div>
            <button
              type="button"
              className="btn blue"
              disabled={!toolId || rating < 1 || mutation.isPending}
              onClick={() => mutation.mutate({ toolId, rating })}
            >
              {mutation.isPending ? "Enviando..." : "Enviar avaliação"}
            </button>
            <button type="button" onClick={onClose} className="more rk-later">
              Agora não
            </button>
          </div>
        ) : (
          <div className="rk-rate plain">
            <p className="fine">
              Entre na sua conta IA News para avaliar as ferramentas que você usa.
            </p>
            <Link to="/auth" className="btn">
              Entrar ou criar conta
            </Link>
            <button type="button" onClick={onClose} className="more rk-later">
              Agora não
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
