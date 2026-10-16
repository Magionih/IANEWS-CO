"""Linha de comando do agente SDR da Sinmed.

  python -m sinmed_sdr analisar   lê as exportações, analisa cada contato e monta a fila
  python -m sinmed_sdr preparar   só lê e calcula os fatos (gera leads.json para análise no Claude Code)
  python -m sinmed_sdr fila       refaz revisão de texto, fila e relatórios a partir de um analise_completa.json
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

from .fila import montar_fila
from .leitores import ler_instagram, ler_planilhas, ler_whatsapp, mesclar
from .modelos import Lead
from .pre_analise import analisar_fatos
from .revisor import revisar
from .saida import gravar
from .sem_ia import analisar_sem_ia

RAIZ = Path(__file__).resolve().parent.parent


def _config(caminho: Path) -> dict:
    padrao = {"nossos_nomes": ["Renata", "Sinmed", "sinmed.co", "Você", "You"], "etiqueta_whatsapp": "SimMed"}
    if caminho.exists():
        padrao.update(json.loads(caminho.read_text(encoding="utf-8")))
    return padrao


def _hoje(texto: str | None) -> datetime:
    return datetime.fromisoformat(texto) if texto else datetime.now().replace(second=0, microsecond=0)


def carregar_leads(dados: Path, config: dict, hoje: datetime) -> list[Lead]:
    grupos = []
    if (dados / "planilhas").exists():
        grupos.append(ler_planilhas(dados / "planilhas"))
    if (dados / "whatsapp").exists():
        grupos.append(ler_whatsapp(dados / "whatsapp", config["nossos_nomes"], config["etiqueta_whatsapp"]))
    if (dados / "instagram").exists():
        grupos.append(ler_instagram(dados / "instagram", config["nossos_nomes"]))
    leads = mesclar(*grupos)
    for lead in leads:
        lead.fatos.update(analisar_fatos(lead, hoje))
    return sorted(leads, key=lambda l: l.nome.lower())


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="sinmed_sdr", description="Agente SDR de remarketing da Sinmed")
    sub = p.add_subparsers(dest="comando", required=True)
    for nome in ("analisar", "preparar"):
        s = sub.add_parser(nome)
        s.add_argument("--dados", type=Path, default=RAIZ / "dados", help="pasta com whatsapp/, instagram/ e planilhas/")
        s.add_argument("--saida", type=Path, default=RAIZ / "saida")
        s.add_argument("--config", type=Path, default=RAIZ / "config.json")
        s.add_argument("--hoje", help="data/hora de referência, ex.: 2026-10-16T09:00")
        s.add_argument("--so", nargs="*", help="analisar só contatos cujo nome contenha estes termos")
    a = sub.choices["analisar"]
    a.add_argument("--sem-ia", action="store_true", help="classificação por regras, sem chamar a API")
    a.add_argument("--paralelos", type=int, default=4)
    a.add_argument("--limite-dia", type=int, default=10)
    f = sub.add_parser("fila")
    f.add_argument("--analise", type=Path, default=RAIZ / "saida" / "analise_completa.json")
    f.add_argument("--saida", type=Path, default=None)
    f.add_argument("--hoje")
    f.add_argument("--limite-dia", type=int, default=10)
    args = p.parse_args(argv)
    hoje = _hoje(args.hoje)

    if args.comando == "fila":
        dados = json.loads(args.analise.read_text(encoding="utf-8"))
        itens = dados["itens"]
        for item in itens:
            a_ = item["analise"]
            if "erro" not in a_ and a_.get("mensagem"):
                a_["problemas_de_texto"] = revisar(a_["mensagem"], item["lead"]["fatos"].get("etapa", ""))
        fila = montar_fila(itens, hoje, args.limite_dia)
        arquivos = gravar(args.saida or args.analise.parent, itens, fila, hoje, dados.get("modo", "manual"))
        _resumo(arquivos, fila)
        return 0

    config = _config(args.config)
    leads = carregar_leads(args.dados, config, hoje)
    if args.so:
        termos = [t.lower() for t in args.so]
        leads = [l for l in leads if any(t in l.nome.lower() for t in termos)]
    if not leads:
        print(f"Nenhum contato encontrado em {args.dados}. Veja o README para exportar as conversas.", file=sys.stderr)
        return 1
    print(f"{len(leads)} contatos carregados de {args.dados}")

    if args.comando == "preparar":
        args.saida.mkdir(parents=True, exist_ok=True)
        destino = args.saida / "leads.json"
        destino.write_text(json.dumps([l.para_dict() for l in leads], ensure_ascii=False, indent=1, default=str), encoding="utf-8")
        print(f"Fatos calculados em {destino}")
        return 0

    if args.sem_ia:
        modo = "regras (sem IA)"
        analises = {l.chave: analisar_sem_ia(l) for l in leads}
    else:
        if not (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN") or os.environ.get("ANTHROPIC_PROFILE")):
            print("Aviso: nenhuma credencial da Anthropic no ambiente; tentando o perfil do `ant auth login`.", file=sys.stderr)
        from .analista import MODELO, analisar_todos

        modo = f"Claude ({MODELO})"
        print(f"Analisando com {MODELO}...")
        analises = analisar_todos(leads, hoje, args.paralelos)

    itens = [{"lead": l.para_dict(), "analise": analises[l.chave]} for l in leads]
    fila = montar_fila(itens, hoje, args.limite_dia)
    arquivos = gravar(args.saida, itens, fila, hoje, modo)
    _resumo(arquivos, fila)
    return 0


def _resumo(arquivos: dict, fila: list[dict]) -> None:
    hoje = [f for f in fila if f["data"] == fila[0]["data"]] if fila else []
    print(f"\nFila: {len(fila)} envios planejados ({len(hoje)} no primeiro dia).")
    for nome, caminho in arquivos.items():
        print(f"  {nome:10} {caminho}")


if __name__ == "__main__":
    sys.exit(main())
