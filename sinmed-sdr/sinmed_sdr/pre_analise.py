"""Pré-análise determinística: fatos que não dependem de interpretação (quem falou por último, quantas
tentativas sem resposta, resposta automática, proposta enviada, pedido de saída) e a etapa da cadência.

Esses fatos alimentam o analista (Claude) e servem de rede de segurança: pedido de saída e limite de
cadência são decididos aqui, no código, e não podem ser contrariados pela análise.
"""

from __future__ import annotations

import re
from datetime import datetime

from .leitores import normalizar
from .modelos import Lead

_AUTOMATICA = re.compile(
    r"(mensagem automatica|resposta automatica|agradecemos (o seu|seu) contato|em breve (retornaremos|responderemos|"
    r"entraremos)|nosso horario de atendimento|fora do (nosso )?horario|digite (o numero|1|uma das opcoes)|"
    r"escolha uma (das )?opc|assistente virtual|sou a assistente|seja bem[- ]vindo|bem[- ]vinda? a clinica|"
    r"para agendar,? (clique|acesse)|menu|ola!? como podemos (te )?ajudar\??$|obrigad[oa] por entrar em contato)"
)
_SAIDA = re.compile(
    r"(\bsair\b|\bpare\b|parem de|nao (me )?(mande|envie|chame)|remova|descadastr|nao quero receber|"
    r"me tire|bloque)"
)
_SEM_INTERESSE = re.compile(
    r"(nao (temos|tenho) interesse|sem interesse|nao interessa|nao precisamos|ja estamos bem|nao e o momento|"
    r"no momento nao|obrigad[oa],? mas nao)"
)
# apresentação em PDF não é proposta; proposta tem valor ou é chamada de proposta/orçamento
_PROPOSTA = re.compile(r"(proposta|orcamento|r\$ ?\d|implantacao|mensalidade)")
_PORTEIRA = re.compile(
    r"(vou (repassar|passar|encaminhar)|repasso|(o|a) (dr|dra|doutor|doutora|medico|medica)\.? (nao|esta|vai|retorna)|"
    r"falar com (o|a) (dr|dra|doutor|doutora|responsavel|gestor)|sou (a )?(secretaria|recepcionista|da recepcao))"
)
_REGISTRO_PLANILHA = "(mensagem de prospecção registrada"

# cadência do livro da marca: msg 1 → +2 dias → +5 dias (contados da primeira) → parar
DIAS_CADENCIA = [0, 2, 5]
DIAS_REATIVACAO = 21
DIAS_FOLLOWUP_PROPOSTA = [2, 5, 10]


def _dias(a: datetime, b: datetime) -> int:
    return (b.date() - a.date()).days


def analisar_fatos(lead: Lead, hoje: datetime) -> dict:
    msgs = lead.mensagens
    nossas = [m for m in msgs if m.nossa]
    deles = [m for m in msgs if not m.nossa]
    automaticas = [m for m in deles if _AUTOMATICA.search(normalizar(m.texto))]
    humanas = [m for m in deles if m not in automaticas]
    ultima_humana = humanas[-1] if humanas else None

    # tentativas nossas desde a última resposta humana (respostas automáticas não zeram a contagem)
    desde = ultima_humana.quando if ultima_humana else datetime.min
    tentativas = [m for m in nossas if m.quando > desde]
    texto_deles = normalizar(" ".join(m.texto for m in humanas))
    texto_nosso = normalizar(" ".join(m.texto for m in nossas))

    fatos = {
        "total_mensagens": len(msgs),
        "mensagens_sinmed": len(nossas),
        "mensagens_clinica_humanas": len(humanas),
        "respostas_automaticas_da_clinica": len(automaticas),
        "primeiro_contato": nossas[0].quando.date().isoformat() if nossas else None,
        "ultimo_envio_sinmed": nossas[-1].quando.date().isoformat() if nossas else None,
        "ultima_resposta_humana": ultima_humana.quando.date().isoformat() if ultima_humana else None,
        "dias_desde_ultimo_envio": _dias(nossas[-1].quando, hoje) if nossas else None,
        "dias_desde_ultima_resposta": _dias(ultima_humana.quando, hoje) if ultima_humana else None,
        "tentativas_sem_resposta": len(tentativas),
        "clinica_falou_por_ultimo": bool(msgs) and not msgs[-1].nossa and msgs[-1] not in automaticas,
        "pediu_para_sair": bool(_SAIDA.search(texto_deles)),
        "declarou_sem_interesse": bool(_SEM_INTERESSE.search(texto_deles)),
        "proposta_enviada": bool(_PROPOSTA.search(texto_nosso)) or "proposta" in normalizar(lead.fatos.get("status_planilha", "")),
        "falou_com_porteira": bool(_PORTEIRA.search(texto_deles)),
        "texto_da_mensagem_1_conhecido": bool(nossas) and not nossas[0].texto.startswith(_REGISTRO_PLANILHA),
        "status_planilha": lead.fatos.get("status_planilha", ""),
    }
    fatos.update(_cadencia(fatos, nossas, hoje))
    return fatos


def _cadencia(f: dict, nossas: list, hoje: datetime) -> dict:
    """Decide se o contato pode receber mensagem e quando, pelas regras fixas."""
    if f["pediu_para_sair"]:
        return {"etapa": "encerrado_pedido_de_saida", "pode_enviar": False, "data_minima_envio": None}
    if not nossas:
        return {"etapa": "mensagem_1", "pode_enviar": True, "data_minima_envio": hoje.date().isoformat()}
    if f["clinica_falou_por_ultimo"]:
        return {"etapa": "responder_clinica", "pode_enviar": True, "data_minima_envio": hoje.date().isoformat()}
    if f["declarou_sem_interesse"]:
        return {"etapa": "encerrado_sem_interesse", "pode_enviar": False, "data_minima_envio": None}

    tentativas = f["tentativas_sem_resposta"]
    ultimo = nossas[-1].quando
    base = nossas[-tentativas].quando if tentativas else ultimo

    if f["proposta_enviada"]:
        etapas = DIAS_FOLLOWUP_PROPOSTA
        nome = "followup_proposta"
    else:
        etapas = DIAS_CADENCIA
        nome = "cadencia"

    if tentativas < len(etapas):
        alvo = base.date().toordinal() + etapas[tentativas]
        etapa = f"{nome}_toque_{tentativas + 1}"
    elif tentativas == len(etapas):
        alvo = ultimo.date().toordinal() + DIAS_REATIVACAO
        etapa = "reativacao_estrategica"
    else:
        return {"etapa": "encerrado_cadencia_completa", "pode_enviar": False, "data_minima_envio": None}

    data = datetime.fromordinal(max(alvo, hoje.date().toordinal())).date()
    return {"etapa": etapa, "pode_enviar": True, "data_minima_envio": data.isoformat()}
