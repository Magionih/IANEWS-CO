"""Monta a fila de envio respeitando os limites que já derrubaram a conta: no máximo N por dia por canal,
intervalo entre envios, só em dia útil entre 8h e 20h. O envio é sempre manual, pela Renata."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from urllib.parse import quote

ACOES_COM_ENVIO = {"responder_agora", "enviar_mensagem", "trocar_canal", "ligar", "escalar_para_joaquim"}
PRIORIDADE_ACAO = {"responder_agora": 0, "escalar_para_joaquim": 1, "enviar_mensagem": 2, "trocar_canal": 3, "ligar": 3}
PRIORIDADE_TEMP = {"quente": 0, "morno": 1, "frio": 2, "perdido": 3}


def _dia_util(d: date) -> date:
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d


def link_envio(canal: str, telefone: str, instagram: str, mensagem: str) -> str:
    if canal == "whatsapp" and telefone:
        numero = telefone if telefone.startswith("55") and len(telefone) >= 12 else "55" + telefone
        return f"https://wa.me/{numero}?text={quote(mensagem)}"
    if canal == "instagram" and instagram:
        return f"https://ig.me/m/{instagram.lstrip('@')}"
    if canal == "telefone" and telefone:
        return f"tel:+{telefone if telefone.startswith('55') else '55' + telefone}"
    return ""


def montar_fila(itens: list[dict], hoje: datetime, limite_por_dia: int = 10, intervalo_min: int = 30) -> list[dict]:
    """`itens` = registros {lead, analise}. Devolve a fila ordenada com data e horário sugeridos."""
    candidatos = []
    for item in itens:
        lead, analise = item["lead"], item["analise"]
        fatos = lead["fatos"]
        if "erro" in analise or analise.get("proxima_acao") not in ACOES_COM_ENVIO or not fatos.get("pode_enviar"):
            continue
        canal = analise.get("canal_recomendado") or lead["canal"]
        if canal == "nenhum":
            continue
        if analise["proxima_acao"] == "ligar":
            canal = "telefone"
        conteudo = analise.get("mensagem") or analise.get("roteiro_ligacao") or ""
        if not conteudo and analise["proxima_acao"] != "responder_agora":
            continue
        minima = date.fromisoformat(fatos.get("data_minima_envio") or hoje.date().isoformat())
        candidatos.append((item, canal, conteudo, minima))

    candidatos.sort(
        key=lambda c: (
            PRIORIDADE_ACAO.get(c[0]["analise"]["proxima_acao"], 9),
            c[3],
            PRIORIDADE_TEMP.get(c[0]["analise"].get("temperatura"), 9),
            -c[0]["analise"].get("score", 0),
        )
    )

    ocupacao: dict[tuple[date, str], int] = {}
    fila = []
    inicio_dia = {"whatsapp": (9, 0), "instagram": (9, 15), "telefone": (14, 0)}
    for item, canal, conteudo, minima in candidatos:
        dia = _dia_util(max(minima, hoje.date()))
        while ocupacao.get((dia, canal), 0) >= limite_por_dia:
            dia = _dia_util(dia + timedelta(days=1))
        posicao = ocupacao.get((dia, canal), 0)
        ocupacao[(dia, canal)] = posicao + 1
        h, m = inicio_dia.get(canal, (9, 0))
        horario = datetime.combine(dia, datetime.min.time()).replace(hour=h, minute=m) + timedelta(minutes=posicao * intervalo_min)
        if dia == hoje.date() and horario < hoje:
            horario = hoje + timedelta(minutes=posicao * intervalo_min)
        if horario.hour >= 20:  # não cabe hoje: primeiro horário do próximo dia útil
            horario = datetime.combine(_dia_util(dia + timedelta(days=1)), datetime.min.time()).replace(hour=h, minute=m)
        lead, analise = item["lead"], item["analise"]
        fila.append(
            {
                "data": horario.date().isoformat(),
                "horario": horario.strftime("%H:%M"),
                "canal": canal,
                "contato": lead["nome"],
                "telefone": lead["telefone"],
                "instagram": lead["instagram"],
                "acao": analise["proxima_acao"],
                "situacao": analise["situacao"],
                "motivo": analise["motivo_principal"],
                "temperatura": analise.get("temperatura", ""),
                "score": analise.get("score", 0),
                "etapa": lead["fatos"].get("etapa", ""),
                "mensagem": conteudo,
                "revisar": "; ".join(analise.get("problemas_de_texto", [])),
                "link": link_envio(canal, lead["telefone"], lead["instagram"], analise.get("mensagem", "")),
                "chave": lead["chave"],
            }
        )
    fila.sort(key=lambda f: (f["data"], f["horario"], f["canal"]))
    return fila
