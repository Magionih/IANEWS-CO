import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { Aceite, Campo, Enviar, Escolha, Isca, Pilulas, Pronto, Texto, useInscricao } from "@/components/site/inscricao-form";
import { CONTATO, MAX, PERFIS, PORTES, rotuloHorario } from "@/lib/inscricao";

/* Conselho IA News: grupo curado e por candidatura de quem coloca IA para trabalhar no Brasil (modelo dos Councils
   da Forbes). Sem preço na página: o investimento é apresentado na conversa de 15 minutos, marcada aqui mesmo. */

const PAGE_URL = "https://ianewsbr.com/conselho";
const DESCRIPTION =
  "Grupo curado de quem coloca IA para trabalhar de verdade no Brasil: artigos assinados na IA News, diretório que recebe pedidos de projeto, mesa mensal e palco. Candidatura aberta para a turma de fundadores.";

export const Route = createFileRoute("/conselho")({
  head: () => ({
    meta: [
      { title: "Conselho IA News · Turma de fundadores | IA News" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Conselho IA News · Turma de fundadores" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: PAGE_URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: PAGE_URL }],
  }),
  component: ConselhoPage,
});

const IMG = (id: number, w: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

const BENEFICIOS = [
  { t: "Matéria de destaque e artigos assinados", d: "Uma matéria na entrada e um artigo seu por trimestre na IA News, com o selo do Conselho." },
  { t: "Diretório que recebe projetos", d: "Seu perfil em \"Quem faz IA\", a vitrine que recebe os pedidos de empresas pelo Balcão de Projetos." },
  { t: "Fonte da redação", d: "Membros são ouvidos nas matérias e nos painéis de especialistas da IA News." },
  { t: "Mesa mensal fechada", d: "Uma hora por mês só entre membros: casos, preços, ferramentas e oportunidades." },
  { t: "Palco", d: "Lugar VIP no Palco IA News e prioridade para dar aulas e palestrar." },
  { t: "Selo do Conselho", d: "Para usar no site, no LinkedIn e nas propostas." },
];

const PASSOS = [
  { n: "1", t: "Candidatura", d: "Você conta o que faz com IA e escolhe um horário." },
  { n: "2", t: "Conversa de 15 minutos", d: "Pelo WhatsApp ou vídeo: entendemos o seu momento e explicamos a turma." },
  { n: "3", t: "Aprovação", d: "A redação confirma se o perfil combina com o critério do Conselho." },
  { n: "4", t: "Boas-vindas", d: "Matéria de entrada, perfil no diretório e convite para a primeira Mesa." },
];

const FAQ = [
  { q: "Quanto custa?", a: "O Conselho é pago, com condição especial para a turma de fundadores. O valor é apresentado na conversa de 15 minutos, depois de entendermos se o seu perfil combina." },
  { q: "Quem pode entrar?", a: "Quem tem IA rodando de verdade, na própria empresa ou em clientes, com um caso que se possa contar. Entrar depende de aprovação." },
  { q: "O conteúdo dos membros é reportagem?", a: "Não. Artigos de membros saem identificados como \"Conselho IA News\", separados do trabalho da redação. A Lista IA News 100 também não tem relação com o Conselho: ninguém paga para entrar nela." },
  { q: "Quantas vagas tem a turma de fundadores?", a: "Até 30. A turma fecha em 22/12 ou quando as vagas acabarem." },
];

type Dia = { chave: string; dia: string; horas: { iso: string; hora: string }[] };

function ConselhoPage() {
  const f = useInscricao("conselho");
  const [horarios, setHorarios] = useState<string[] | null>(null);
  const [diaSel, setDiaSel] = useState<string | null>(null);

  const carregar = useCallback(() => {
    fetch("/api/public/inscricao?horarios=conselho", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { horarios?: string[] }) => setHorarios(j.horarios ?? []))
      .catch(() => setHorarios([]));
  }, []);
  useEffect(carregar, [carregar]);

  const dias = useMemo<Dia[]>(() => {
    const m = new Map<string, Dia>();
    for (const iso of horarios ?? []) {
      const r = rotuloHorario(iso);
      if (!m.has(r.chave)) m.set(r.chave, { chave: r.chave, dia: r.dia, horas: [] });
      m.get(r.chave)!.horas.push({ iso, hora: r.hora });
    }
    return [...m.values()].slice(0, 7);
  }, [horarios]);

  const dia = dias.find((d) => d.chave === diaSel) ?? dias[0];
  const escolhido = f.form.horario ? rotuloHorario(f.form.horario) : null;

  return (
    <>
      <SiteHeader />
      <main id="main" className="pc2">
        <section className="pc2-hero" style={{ backgroundImage: `url(${IMG(20733081, 1600)})` }}>
          <div className="pc2-shade" aria-hidden="true" />
          <div className="wrap pc2-hero-grid">
            <div className="pc2-hero-copy">
              <p className="pc2-kick">IA News · Por candidatura</p>
              <h1>
                Conselho IA News
                <span>Para quem faz IA acontecer no Brasil.</span>
              </h1>
              <p className="pc2-sub">
                Um grupo curado de fundadores, especialistas e executivos que colocam IA para trabalhar de verdade. Quem entra ganha
                voz na IA News, vitrine para novos projetos e uma rede de quem está fazendo.
              </p>
              <ul className="pc2-facts">
                <li>
                  <small>Turma</small>
                  <b>Fundadores · até 30 vagas</b>
                </li>
                <li>
                  <small>Entrada</small>
                  <b>Candidatura e conversa</b>
                </li>
                <li>
                  <small>Fecha em</small>
                  <b>22/12</b>
                </li>
              </ul>
              <a className="pc2-link" href="#beneficios">
                Ver o que o membro recebe ↓
              </a>
            </div>

            <div className="pc2-form" id="candidatura">
              <div className="pc2-form-head">
                <span className="pc2-badge">Turma de fundadores</span>
                <h2>Candidate-se</h2>
                <p>Conte o que você faz e escolha o horário da conversa de 15 minutos.</p>
              </div>
              <div className="biz-card pt-card-form">
                {f.feito ? (
                  <Pronto titulo={f.feito.already ? "Sua candidatura já estava com a gente" : "Candidatura recebida!"}>
                    <p>
                      {f.feito.agendado_em
                        ? `Combinado${f.feito.nome ? `, ${f.feito.nome}` : ""}: nossa conversa é ${rotuloHorario(f.feito.agendado_em).dia}, às ${rotuloHorario(f.feito.agendado_em).hora}. Vamos te chamar pelo WhatsApp que você informou.`
                        : `Obrigada${f.feito.nome ? `, ${f.feito.nome}` : ""}. Vamos te chamar pelo WhatsApp em até 1 dia útil para marcar a conversa.`}
                    </p>
                  </Pronto>
                ) : (
                  <form className="biz-form" onSubmit={(e) => f.enviar(e, carregar)} noValidate>
                    <Isca f={f} />
                    <fieldset>
                      <legend className="pc2-sr">Seus dados</legend>
                      <div className="biz-fields">
                        <Campo f={f} k="nome" rotulo="Nome completo" autoComplete="name" maxLength={160} placeholder="Seu nome" cheio />
                        <Campo f={f} k="empresa" rotulo="Empresa" autoComplete="organization" maxLength={160} placeholder="Nome da empresa" />
                        <Campo f={f} k="cargo" rotulo="Cargo" opcional autoComplete="organization-title" maxLength={120} placeholder="Fundador, CEO..." />
                        <Campo f={f} k="whatsapp" rotulo="WhatsApp" type="tel" inputMode="tel" autoComplete="tel-national" maxLength={16} placeholder="(00) 00000-0000" />
                        <Campo f={f} k="email" rotulo="E-mail" type="email" inputMode="email" autoComplete="email" maxLength={254} placeholder="voce@empresa.com.br" />
                        <Campo f={f} k="linkedin" rotulo="LinkedIn ou site" opcional maxLength={300} placeholder="linkedin.com/in/..." />
                        <Escolha f={f} k="porte" rotulo="Pessoas na empresa" opcoes={PORTES} opcional />
                      </div>
                    </fieldset>
                    <Pilulas f={f} k="perfil" legenda="Você" opcoes={PERFIS} />
                    <div className="biz-fields">
                      <Texto
                        f={f}
                        k="caso"
                        rotulo="O que você faz com IA, e um resultado"
                        max={MAX.caso}
                        linhas={3}
                        placeholder="Ex.: implantamos agentes de atendimento em 40 clínicas; o tempo de resposta caiu de 2 horas para 3 minutos."
                      />
                    </div>

                    <fieldset className="ins-slots" data-campo="horario">
                      <legend className="pc2-legend">Horário da conversa de 15 minutos (Brasília)</legend>
                      {horarios === null ? (
                        <p className="pc2-note">Carregando horários…</p>
                      ) : dias.length === 0 ? (
                        <p className="pc2-note">Sem horários na agenda agora. Envie a candidatura e a gente te chama para marcar.</p>
                      ) : (
                        <>
                          <div className="ins-dias" role="tablist" aria-label="Dia">
                            {dias.map((d) => (
                              <button
                                key={d.chave}
                                type="button"
                                role="tab"
                                aria-selected={dia?.chave === d.chave}
                                className={dia?.chave === d.chave ? "on" : undefined}
                                onClick={() => setDiaSel(d.chave)}
                              >
                                {d.dia}
                              </button>
                            ))}
                          </div>
                          <div className="ins-horas">
                            {dia?.horas.map((h) => (
                              <button
                                key={h.iso}
                                type="button"
                                aria-pressed={f.form.horario === h.iso}
                                className={f.form.horario === h.iso ? "on" : undefined}
                                onClick={() => f.set("horario", f.form.horario === h.iso ? "" : h.iso)}
                              >
                                {h.hora}
                              </button>
                            ))}
                          </div>
                          <p className="ins-escolhido" aria-live="polite">
                            {escolhido ? `Escolhido: ${escolhido.dia}, às ${escolhido.hora}.` : "Nenhum horário escolhido: a gente te chama para marcar."}
                          </p>
                        </>
                      )}
                      {f.erros.horario ? <span className="pt-err">{f.erros.horario}</span> : null}
                    </fieldset>

                    <Aceite f={f} texto="Aceito que a IA News fale comigo por WhatsApp e e-mail sobre o Conselho." />
                    <Enviar f={f} rotulo="Enviar candidatura" fino="A entrada depende de aprovação." />
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="wrap">
          <section className="pc2-sec" id="beneficios" aria-labelledby="c-ben">
            <p className="pc2-eyebrow">O que o membro recebe</p>
            <h2 id="c-ben" className="pc2-h2">
              Voz, vitrine e rede, o ano inteiro.
            </h2>
            <div className="ins-grid">
              {BENEFICIOS.map((b) => (
                <article key={b.t} className="ins-tile">
                  <h3>{b.t}</h3>
                  <p>{b.d}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="pc2-sec" aria-labelledby="c-como">
            <p className="pc2-eyebrow">Como entrar</p>
            <h2 id="c-como" className="pc2-h2">
              Por candidatura, não por compra.
            </h2>
            <ol className="ins-passos">
              {PASSOS.map((p) => (
                <li key={p.n}>
                  <span>{p.n}</span>
                  <b>{p.t}</b>
                  <p>{p.d}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="pc2-sec" aria-labelledby="c-faq">
            <p className="pc2-eyebrow">Dúvidas</p>
            <h2 id="c-faq" className="pc2-h2">
              Perguntas frequentes
            </h2>
            <div className="faq">
              {FAQ.map((x) => (
                <details key={x.q}>
                  <summary>{x.q}</summary>
                  <p>{x.a}</p>
                </details>
              ))}
              <details>
                <summary>Outro assunto?</summary>
                <p>
                  Escreva para <a href={`mailto:${CONTATO}`}>{CONTATO}</a>.
                </p>
              </details>
            </div>
          </section>
        </div>

        <section className="pc2-final" style={{ backgroundImage: `url(${IMG(7648057, 1600)})` }}>
          <div className="pc2-shade" aria-hidden="true" />
          <div className="wrap pc2-final-in">
            <h2>A turma de fundadores tem até 30 vagas.</h2>
            <p>Candidaturas até 22/12.</p>
            <a className="btn blue pc2-submit" href="#candidatura">
              Quero me candidatar
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
