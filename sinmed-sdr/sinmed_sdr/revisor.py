"""Revisor de texto: aplica as regras fixas do livro da marca em toda mensagem antes de ela ir para a fila.

Uma mensagem com problema não é descartada: volta para o analista reescrever (modo com Claude) ou fica
marcada como "revisar" para a Renata ajustar à mão.
"""

from __future__ import annotations

import re

from .leitores import normalizar

_PROIBIDAS = {
    r"\bia\b": '"IA"',
    r"inteligencia artificial": '"inteligência artificial"',
    r"\brobo": '"robô"',
    r"chat ?bot": '"chatbot"',
    r"revolucion": '"revolucionar"',
    r"transform(e|a|ar|acao)\b": '"transformar"',
    r"disruptiv": '"disruptivo"',
    r"\blead": '"lead"',
    r"\bautomacao\b": '"automação" (não é a promessa principal; use "secretária virtual")',
}
# números permitidos: os dados com fonte do livro da marca e a tabela de preços oficial
_NUMEROS_COM_FONTE = {"77%", "33%", "29%", "19%", "16%", "13%", "5%"}
_PRECOS_OFICIAIS = {"5.000", "7.500", "4.750", "7.125", "990", "416,67", "625", "16.880", "19.380"}
_LINK = re.compile(r"(https?://|www\.|\.com\b|\.site\b|\.pdf\b)", re.I)
_EMOJI = re.compile("[\U0001F300-\U0001FAFF☀-➿]")
LIMITE_CARACTERES = 700


def revisar(mensagem: str, etapa: str, clinica_pediu_24h: bool = False) -> list[str]:
    """Devolve a lista de problemas encontrados (vazia quando a mensagem está pronta)."""
    problemas: list[str] = []
    texto = normalizar(mensagem)
    if not mensagem.strip():
        return ["mensagem vazia"]

    for padrao, rotulo in _PROIBIDAS.items():
        if re.search(padrao, texto):
            problemas.append(f"usa termo proibido {rotulo}")

    if "renata" not in texto[-160:]:
        problemas.append("não está assinada pela Renata (Sinmed, BH) no final")
    if etapa == "mensagem_1":
        if _LINK.search(mensagem):
            problemas.append("primeira mensagem não pode ter link nem PDF")
        if "secretaria virtual" not in texto:
            problemas.append('primeira mensagem precisa citar "secretária virtual"')
        if "?" not in mensagem:
            problemas.append("primeira mensagem precisa terminar com uma pergunta pedindo licença")
    if not clinica_pediu_24h and re.search(r"24 ?(h\b|horas)|24/7", texto):
        problemas.append("promete atendimento 24 horas (só permitido para quem pediu 24/7)")

    for pct in re.findall(r"\d+(?:[.,]\d+)?\s?%", mensagem):
        if pct.replace(" ", "") not in _NUMEROS_COM_FONTE:
            problemas.append(f"percentual sem fonte ({pct})")
    for valor in re.findall(r"R\$\s?([\d.,]+)", mensagem):
        if valor.rstrip(".,") not in _PRECOS_OFICIAIS:
            problemas.append(f"valor fora da tabela oficial (R$ {valor})")

    if len(_EMOJI.findall(mensagem)) > 1:
        problemas.append("mais de 1 emoji")
    if len(mensagem) > LIMITE_CARACTERES:
        problemas.append(f"longa demais ({len(mensagem)} caracteres; limite {LIMITE_CARACTERES})")
    if re.search(r"\{[a-z_]+\}|\[(nome|clinica|cl[ií]nica)\]", mensagem, re.I):
        problemas.append("ficou um campo de modelo sem preencher")
    return problemas
