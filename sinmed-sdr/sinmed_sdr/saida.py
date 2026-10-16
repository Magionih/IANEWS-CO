"""Gera os arquivos de saída: análise completa (JSON), fila (CSV), relatório (Markdown) e painel de envio (HTML)."""

from __future__ import annotations

import csv
import html
import json
from collections import Counter
from datetime import datetime
from pathlib import Path

ROTULOS = {
    "aguardando_nossa_resposta": "Aguardando NOSSA resposta",
    "respondeu_interessado": "Respondeu com interesse",
    "respondeu_com_objecao": "Respondeu com objeção",
    "proposta_enviada_sem_retorno": "Proposta sem retorno",
    "so_resposta_automatica": "Só resposta automática",
    "sem_resposta": "Sem resposta",
    "nunca_contatado": "Ainda não contatado",
    "respondeu_sem_interesse": "Sem interesse",
    "pediu_para_sair": "Pediu para sair",
    "diagnostico_ou_reuniao_marcada": "Diagnóstico/reunião marcada",
}


def _rotulo(valor: str) -> str:
    return ROTULOS.get(valor, valor.replace("_", " "))


def gravar(pasta: Path, itens: list[dict], fila: list[dict], hoje: datetime, modo: str) -> dict[str, Path]:
    pasta.mkdir(parents=True, exist_ok=True)
    arquivos = {
        "analise": pasta / "analise_completa.json",
        "fila": pasta / "fila_envio.csv",
        "relatorio": pasta / "relatorio.md",
        "painel": pasta / "painel.html",
    }
    arquivos["analise"].write_text(
        json.dumps({"gerado_em": hoje.isoformat(timespec="minutes"), "modo": modo, "itens": itens}, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    with arquivos["fila"].open("w", newline="", encoding="utf-8-sig") as f:
        colunas = ["data", "horario", "canal", "contato", "telefone", "instagram", "acao", "situacao", "motivo",
                   "temperatura", "score", "etapa", "mensagem", "revisar", "link"]
        escritor = csv.DictWriter(f, fieldnames=colunas, extrasaction="ignore", delimiter=";")
        escritor.writeheader()
        escritor.writerows(fila)
    arquivos["relatorio"].write_text(_relatorio(itens, fila, hoje, modo), encoding="utf-8")
    arquivos["painel"].write_text(_painel(itens, fila, hoje, modo), encoding="utf-8")
    return arquivos


def _relatorio(itens: list[dict], fila: list[dict], hoje: datetime, modo: str) -> str:
    validos = [i for i in itens if "erro" not in i["analise"]]
    erros = [i for i in itens if "erro" in i["analise"]]
    situacoes = Counter(i["analise"]["situacao"] for i in validos)
    motivos = Counter(i["analise"]["motivo_principal"] for i in validos)
    objecoes = Counter(o.strip().lower() for i in validos for o in i["analise"].get("objecoes_detectadas", []))
    hoje_fila = [f for f in fila if f["data"] == hoje.date().isoformat()]

    l = [f"# Remarketing Sinmed — análise de {hoje:%d/%m/%Y}", ""]
    l.append(f"Modo: **{modo}** · contatos analisados: **{len(itens)}** · na fila: **{len(fila)}** "
             f"(hoje: {len(hoje_fila)}) · erros: {len(erros)}")
    l += ["", "## Situação dos contatos", "", "| Situação | Contatos |", "|---|---|"]
    l += [f"| {_rotulo(s)} | {n} |" for s, n in situacoes.most_common()]
    l += ["", "## Por que não responderam / travaram", "", "| Motivo principal | Contatos |", "|---|---|"]
    l += [f"| {_rotulo(m)} | {n} |" for m, n in motivos.most_common()]
    if objecoes:
        l += ["", "## Objeções que apareceram", ""]
        l += [f"- {o} ({n})" for o, n in objecoes.most_common(15)]

    urgentes = [i for i in validos if i["analise"]["proxima_acao"] in ("responder_agora", "escalar_para_joaquim")]
    if urgentes:
        l += ["", "## Fazer hoje antes de tudo", ""]
        for i in urgentes:
            l.append(f"- **{i['lead']['nome']}** — {_rotulo(i['analise']['proxima_acao'])}: {i['analise']['diagnostico']}")

    l += ["", "## Contato a contato", ""]
    ordem = sorted(validos, key=lambda i: (-i["analise"].get("score", 0), i["lead"]["nome"]))
    for i in ordem:
        lead, a, fatos = i["lead"], i["analise"], i["lead"]["fatos"]
        contato = " · ".join(x for x in (lead["telefone"], lead["instagram"], lead["lote"]) if x)
        l += [f"### {lead['nome']}  ({a.get('temperatura', '')}, score {a.get('score', 0)})", ""]
        l.append(f"{contato}  ")
        l.append(f"**Situação:** {_rotulo(a['situacao'])} · **Motivo:** {_rotulo(a['motivo_principal'])} · "
                 f"**Etapa:** {fatos.get('etapa')} · **Tentativas sem resposta:** {fatos.get('tentativas_sem_resposta')}  ")
        l.append(f"**Diagnóstico:** {a['diagnostico']}  ")
        if a.get("evidencias"):
            l.append("**Evidências:** " + " | ".join(f"“{e}”" for e in a["evidencias"][:4]) + "  ")
        if a.get("estrategia"):
            l.append(f"**Estratégia:** {a['estrategia']}  ")
        l.append(f"**Próxima ação:** {_rotulo(a['proxima_acao'])} por {a.get('canal_recomendado')} "
                 f"a partir de {fatos.get('data_minima_envio') or '—'}")
        if a.get("mensagem"):
            l += ["", "> " + a["mensagem"].replace("\n", "\n> ")]
        if a.get("roteiro_ligacao"):
            l += ["", "**Roteiro de ligação:** " + a["roteiro_ligacao"]]
        if a.get("mensagem_seguinte_se_nao_responder"):
            l += ["", "<details><summary>Próximo toque se não responder</summary>", "",
                  a["mensagem_seguinte_se_nao_responder"], "", "</details>"]
        alertas = a.get("alertas", []) + [f"revisar texto: {p}" for p in a.get("problemas_de_texto", [])]
        if alertas:
            l += [""] + [f"- ⚠ {x}" for x in alertas]
        l.append("")
    if erros:
        l += ["## Não analisados (rodar de novo)", ""]
        l += [f"- {i['lead']['nome']}: {i['analise']['erro']}" for i in erros]
    return "\n".join(l) + "\n"


def _painel(itens: list[dict], fila: list[dict], hoje: datetime, modo: str) -> str:
    e = html.escape
    cartoes = []
    dia_atual = None
    for f in fila:
        if f["data"] != dia_atual:
            dia_atual = f["data"]
            dia = datetime.fromisoformat(dia_atual)
            cartoes.append(f'<h2>{dia:%d/%m} · {["seg", "ter", "qua", "qui", "sex", "sáb", "dom"][dia.weekday()]}</h2>')
        abrir = f'<a class="btn" href="{e(f["link"])}" target="_blank" rel="noopener">Abrir {e(f["canal"])}</a>' if f["link"] else ""
        revisar = f'<p class="alerta">Revisar: {e(f["revisar"])}</p>' if f["revisar"] else ""
        cartoes.append(
            f'''<article class="cartao t-{e(f["temperatura"])}">
  <header><strong>{e(f["horario"])} · {e(f["contato"])}</strong>
  <span class="tag">{e(_rotulo(f["situacao"]))}</span><span class="tag">{e(_rotulo(f["motivo"]))}</span>
  <span class="tag">{e(f["temperatura"])} · {f["score"]}</span></header>
  <pre>{e(f["mensagem"]) or "(responder lendo a conversa)"}</pre>{revisar}
  <footer><button onclick="copiar(this)">Copiar texto</button>{abrir}
  <label><input type="checkbox" data-chave="{e(f["chave"])}" onchange="marcar(this)"> enviado</label></footer>
</article>'''
        )
    situacoes = Counter(i["analise"].get("situacao", "erro") for i in itens)
    resumo = "".join(f"<li><b>{n}</b> {e(_rotulo(s))}</li>" for s, n in situacoes.most_common())
    return f"""<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fila Sinmed</title>
<style>
:root{{--petroleo:#1F4E5F;--escuro:#17323C;--off:#F8F7F4;--areia:#D9CCBA;--areia2:#EEE7DC;--cinza:#6E6E6E;--dourado:#B9975B}}
body{{margin:0;background:var(--off);color:var(--escuro);font:15px/1.5 "DM Sans",system-ui,sans-serif}}
main{{max-width:860px;margin:0 auto;padding:24px 16px}}
h1{{font-family:"Libre Baskerville",Georgia,serif;font-weight:400;margin:0 0 4px}}
h2{{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#8A6D3B;margin:32px 0 8px}}
.sub{{color:var(--cinza);margin:0 0 16px}} ul.resumo{{display:flex;flex-wrap:wrap;gap:8px;padding:0;list-style:none}}
ul.resumo li{{background:var(--areia2);border-radius:999px;padding:4px 12px}}
.cartao{{background:#fff;border:1px solid var(--areia);border-left:4px solid var(--areia);border-radius:12px;padding:14px 16px;margin:10px 0}}
.t-quente{{border-left-color:var(--dourado)}} .t-morno{{border-left-color:var(--petroleo)}}
.cartao.feito{{opacity:.45}} header{{display:flex;flex-wrap:wrap;gap:6px;align-items:center}}
.tag{{font-size:12px;background:var(--areia2);border-radius:6px;padding:2px 8px;color:var(--cinza)}}
pre{{white-space:pre-wrap;font:inherit;background:var(--off);border-radius:8px;padding:10px 12px;margin:10px 0}}
footer{{display:flex;gap:10px;align-items:center;flex-wrap:wrap}}
button,.btn{{background:var(--petroleo);color:#fff;border:0;border-radius:8px;padding:7px 14px;font:inherit;cursor:pointer;text-decoration:none}}
.btn{{background:#fff;color:var(--petroleo);border:1px solid var(--petroleo)}} .alerta{{color:#8a3b2b;font-size:13px}}
</style></head><body><main>
<h1>Fila de remarketing</h1>
<p class="sub">Gerada em {hoje:%d/%m/%Y %H:%M} · modo {e(modo)} · {len(fila)} envios planejados · envio sempre manual, no máximo 10 por dia por canal</p>
<ul class="resumo">{resumo}</ul>
{"".join(cartoes) or "<p>Nenhum envio planejado.</p>"}
</main><script>
function copiar(b){{navigator.clipboard.writeText(b.closest('article').querySelector('pre').innerText);b.textContent='Copiado';}}
function marcar(c){{c.closest('article').classList.toggle('feito',c.checked);try{{localStorage.setItem('sinmed:'+c.dataset.chave,c.checked?'1':'')}}catch(e){{}}}}
document.querySelectorAll('input[data-chave]').forEach(c=>{{try{{if(localStorage.getItem('sinmed:'+c.dataset.chave)){{c.checked=true;marcar(c)}}}}catch(e){{}}}});
</script></body></html>
"""
