import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PortalSubscribeForm, useSubscribed } from "@/components/site/portal-subscribe";
import { rateAiTool, type AiTool } from "@/lib/ai-ranking.functions";
import { AREAS, RankLogo, Stars, catLabel, fmtScore, scoreFor } from "./rank-shared";

/* Diálogos da página Ranking IA: comparação, ficha da ferramenta e avaliação do leitor. */

export function CompareDialog({
  tools,
  open,
  onClose,
  onClear,
}: {
  tools: AiTool[];
  open: boolean;
  onClose: () => void;
  onClear: () => void;
}) {
  const subscribed = useSubscribed();
  const rows: { label: string; get: (t: AiTool) => string }[] = [
    { label: "Fabricante", get: (t) => t.maker },
    { label: "Posição no ranking", get: (t) => `#${t.rank_position}` },
    { label: "Nota do dia", get: (t) => fmtScore(t.weekly_score) },
    { label: "Nota técnica", get: (t) => fmtScore(t.base_score) },
    { label: "Repercussão", get: (t) => fmtScore(t.buzz_score) },
    {
      label: "Leitores",
      get: (t) =>
        t.ratings_count > 0
          ? `${t.ratings_avg.toFixed(1).replace(".", ",")}/5 (${t.ratings_count})`
          : "sem notas",
    },
    { label: "Contexto", get: (t) => t.context_window || "—" },
    { label: "Preço", get: (t) => t.pricing || "—" },
    { label: "Desde", get: (t) => t.released || "—" },
    { label: "Ponto forte", get: (t) => t.pros[0] ?? "—" },
    { label: "Atenção", get: (t) => t.cons[0] ?? "—" },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rk-dlg max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <p className="kick">Ranking IA</p>
          <DialogTitle className="rk-dlg-t">Comparar ferramentas</DialogTitle>
          <DialogDescription className="rk-dlg-d">
            Comparativo lado a lado com desempenho técnico, repercussão do dia e nota dos leitores.
          </DialogDescription>
        </DialogHeader>

        <div className="rk-cmp-wrap">
          <table className="rk-cmp">
            <thead>
              <tr>
                <th scope="col">Critério</th>
                {tools.map((t) => (
                  <th key={t.id} scope="col">
                    <span className="rk-cmp-who">
                      <RankLogo m={t} />
                      <b>{t.name}</b>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  {tools.map((t) => (
                    <td key={t.id}>{r.get(t)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!subscribed ? (
          <div className="rk-dlg-band">
            <p>
              <b>Receba o comparativo completo toda semana.</b> Toda segunda-feira, o ranking das
              plataformas de IA, o que subiu na semana e como aplicar no seu negócio.
            </p>
            <PortalSubscribeForm placement="ranking-band" button="Receber grátis" />
          </div>
        ) : null}

        <div>
          <button type="button" onClick={onClear} className="more">
            Limpar seleção
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
        <b>Avalie esta ferramenta</b>
        <p className="fine">
          Entre na sua conta IA News para dar sua nota e influenciar o ranking de amanhã.
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

export function ToolDialog({
  tool,
  activeArea,
  activeLabel,
  myRating,
  isAuthenticated,
  onClose,
  onSaved,
}: {
  tool: AiTool | null;
  activeArea: string;
  activeLabel: string;
  myRating: { rating: number; use_case: string | null; comment: string | null } | null;
  isAuthenticated: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={!!tool} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rk-dlg max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {tool ? (
          <>
            <DialogHeader>
              <div className="rk-dlg-who">
                <RankLogo m={tool} />
                <div>
                  <DialogTitle className="rk-dlg-t">{tool.name}</DialogTitle>
                  <DialogDescription className="rk-dlg-d">
                    {tool.maker} · {catLabel(tool.category)}
                    {tool.released ? ` · desde ${tool.released}` : ""}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <p className="rk-dlg-about">{tool.about}</p>

            <div className="rk-kpis">
              <div>
                <span>Nota do dia</span>
                <b>{fmtScore(tool.weekly_score)}</b>
              </div>
              <div>
                <span>Posição</span>
                <b>#{tool.rank_position}</b>
              </div>
              <div>
                <span>Leitores</span>
                <b className="sm">
                  {tool.ratings_count > 0
                    ? `${tool.ratings_avg.toFixed(1).replace(".", ",")} / 5 (${tool.ratings_count})`
                    : "Seja o primeiro"}
                </b>
              </div>
            </div>

            {tool.context_window ? <p className="fine">Contexto: {tool.context_window}</p> : null}

            <div className="rk-areas">
              <p className="rk-lb">Notas por área</p>
              {AREAS.filter((a) => a.key !== "semanal" && a.key !== "avaliacao").map((a) => (
                <div key={a.key} className={"rk-area" + (a.key === activeArea ? " on" : "")}>
                  <span>{a.label}</span>
                  <span className="rk-bar">
                    <i
                      style={{
                        ["--v" as string]: `${Math.max(0, Math.min(100, scoreFor(tool, a.key) * 10))}%`,
                      }}
                    />
                  </span>
                  <b>{fmtScore(scoreFor(tool, a.key))}</b>
                </div>
              ))}
              <p className="sr-only">Área em destaque: {activeLabel}</p>
            </div>

            <div className="rk-pc">
              <div>
                <p className="rk-lb">Pontos fortes</p>
                <ul>
                  {tool.pros.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="rk-lb">Pontos de atenção</p>
                <ul>
                  {tool.cons.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            </div>

            {tool.pricing ? <p className="fine">{tool.pricing}</p> : null}

            <RatingForm
              tool={tool}
              initial={myRating}
              isAuthenticated={isAuthenticated}
              onSaved={onSaved}
            />

            {tool.website ? (
              <a href={tool.website} target="_blank" rel="noreferrer noopener" className="btn line">
                Visitar plataforma <ExternalLink className="ico" aria-hidden="true" />
              </a>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

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
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rk-dlg sm:max-w-md">
        <DialogHeader>
          <p className="kick">Voto do leitor</p>
          <DialogTitle className="rk-dlg-t">Qual IA você mais usa?</DialogTitle>
          <DialogDescription className="rk-dlg-d">
            Leva 10 segundos. Sua nota entra no cálculo do ranking de amanhã.
          </DialogDescription>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
}
