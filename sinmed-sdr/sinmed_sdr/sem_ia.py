"""Modo sem IA: classificação por regras e mensagens de modelo, para rodar sem chave da API (ou para testar).

O resultado tem o mesmo formato da análise do Claude, mas é mais raso: não lê nuance da conversa. Toda
mensagem sai marcada para revisão humana.
"""

from __future__ import annotations

from .leitores import normalizar
from .modelos import Lead
from .revisor import revisar

ASSINATURA = "Renata, da Sinmed (BH)"


def saudacao(lead: Lead) -> str:
    nome = lead.nome.strip()
    if normalizar(nome).startswith(("dr ", "dr.", "dra", "doutor")):
        return nome.split(" - ")[0]
    if nome.startswith("+") or sum(c.isdigit() for c in nome) >= 8:
        return "tudo bem"
    artigo = "do" if normalizar(nome).startswith(("consultorio", "instituto", "centro", "espaco", "nucleo")) else "da"
    return f"equipe {artigo} {nome}"


def _mensagem_1(s: str) -> str:
    abertura = f"Oi, {s}! Aqui é a Renata, da Sinmed, de BH." if s != "tudo bem" else "Oi, tudo bem? Aqui é a Renata, da Sinmed, de BH."
    return (
        f"{abertura} A gente coloca uma secretária virtual no WhatsApp da própria clínica: ela responde o paciente, "
        "informa convênio e particular e já marca na agenda, junto com a equipe. "
        "Posso te enviar por aqui uma apresentação curta, em PDF?\n" + ASSINATURA
    )


_TOQUES = {
    2: (
        "Oi, {s}! Retomando rapidinho: quando o paciente pergunta horário no WhatsApp e a recepção está no balcão, "
        "ele costuma procurar outra clínica. A secretária virtual responde na hora, no número de vocês, e passa para a "
        "equipe o que precisa de gente. Faz sentido eu te mostrar em 20 minutos como seria aí?\n" + ASSINATURA
    ),
    3: (
        "Oi, {s}! Última mensagem por aqui, prometo. Fazemos um diagnóstico gratuito do WhatsApp da clínica: tempo até "
        "a primeira resposta, mensagens sem resposta e onde a agenda perde consulta. São 20 minutos, online ou "
        "presencial. Quer que eu reserve um horário para vocês?\n" + ASSINATURA
    ),
}
_REATIVACAO = (
    "Oi, {s}! Aqui é a Renata, da Sinmed. Passando com outro assunto: horário vazio por falta sem aviso. A "
    "secretária virtual confirma a consulta na véspera e oferece a vaga para quem está na lista de espera, sem "
    "ninguém digitar. Se fizer sentido para a rotina de vocês, posso mostrar em 20 minutos?\n" + ASSINATURA
)
_PROPOSTA = {
    1: (
        "Oi, {s}! Conseguiram olhar a proposta com calma? Se quiserem, faço uma chamada rápida para tirar dúvidas "
        "com vocês e com quem mais participa da decisão. Qual dia fica melhor?\n" + ASSINATURA
    ),
    2: (
        "Oi, {s}! Lembrando que dá para começar só pela integração com o sistema que vocês já usam, e a agenda "
        "continua onde está. Ficou alguma dúvida sobre valores ou prazo que eu possa resolver?\n" + ASSINATURA
    ),
    3: (
        "Oi, {s}! Para eu organizar a agenda de implantação aqui: faz sentido seguirmos agora ou prefere que eu volte "
        "a falar com vocês em outro momento? Qualquer resposta me ajuda.\n" + ASSINATURA
    ),
}
_AUTOMATICA = (
    "Oi! Recebi a mensagem automática de vocês, obrigada. Aqui é a Renata, da Sinmed, de BH. O assunto é com o(a) "
    "médico(a) responsável ou com a gestão: uma secretária virtual que trabalha junto com a recepção no WhatsApp da "
    "clínica. Pode me indicar com quem falo, ou me passar o melhor contato?\n" + ASSINATURA
)


def analisar_sem_ia(lead: Lead) -> dict:
    f = lead.fatos
    s = saudacao(lead)
    etapa = f.get("etapa", "")
    base = {
        "motivos_secundarios": [],
        "evidencias": [],
        "objecoes_detectadas": [],
        "perfil_clinica": "indefinido",
        "interlocutor": "desconhecido",
        "gancho_personalizacao": "",
        "roteiro_ligacao": "",
        "mensagem_seguinte_se_nao_responder": "",
        "alertas": ["análise por regras (modo sem IA): revisar antes de enviar"],
        "canal_recomendado": lead.canal,
        "mensagem": "",
    }
    status_planilha = normalizar(f.get("status_planilha", ""))

    if f.get("pediu_para_sair"):
        r = dict(situacao="pediu_para_sair", motivo_principal="sem_interesse_real", proxima_acao="encerrar",
                 temperatura="perdido", score=0, canal_recomendado="nenhum",
                 diagnostico="O contato pediu para não receber mais mensagens. Encerrado para sempre.")
    elif f.get("clinica_falou_por_ultimo"):
        r = dict(situacao="aguardando_nossa_resposta", motivo_principal="nossa_falha_de_followup",
                 proxima_acao="responder_agora", temperatura="quente", score=70,
                 diagnostico="A clínica escreveu por último e ainda não foi respondida. Responder hoje, lendo a conversa.",
                 mensagem="")
        base["alertas"].append("escrever a resposta à mão: o modo sem IA não interpreta a última mensagem")
    elif f.get("declarou_sem_interesse"):
        r = dict(situacao="respondeu_sem_interesse", motivo_principal="sem_interesse_real", proxima_acao="encerrar",
                 temperatura="perdido", score=5, canal_recomendado="nenhum",
                 diagnostico="Declarou sem interesse. Não insistir; revisitar só se houver novo gatilho.")
    elif "nao aceita" in status_planilha or "dm fechad" in status_planilha:
        r = dict(situacao="nunca_contatado", motivo_principal="canal_errado_ou_dm_fechada", proxima_acao="trocar_canal",
                 temperatura="frio", score=25, canal_recomendado="telefone" if not lead.telefone else "whatsapp",
                 diagnostico="O perfil não aceita DM de desconhecidos; usar telefone ou o WhatsApp da bio.",
                 mensagem=_mensagem_1(s))
        if not lead.telefone:
            base["alertas"].append("buscar o telefone ou o WhatsApp da bio do perfil antes de enviar")
    elif not f.get("mensagens_sinmed"):
        r = dict(situacao="nunca_contatado", motivo_principal="nao_se_aplica", proxima_acao="enviar_mensagem",
                 temperatura="frio", score=20, diagnostico="Ainda não recebeu a mensagem 1.",
                 mensagem=_mensagem_1(s))
    elif f.get("proposta_enviada"):
        toque = int(etapa.rsplit("_", 1)[-1]) if etapa.startswith("followup_proposta") else 3
        r = dict(situacao="proposta_enviada_sem_retorno", motivo_principal="indeterminado",
                 proxima_acao="enviar_mensagem" if f.get("pode_enviar") else "encerrar",
                 temperatura="morno", score=45,
                 diagnostico="Proposta enviada sem retorno. Descobrir o que travou: preço, sócio, timing ou comparação.",
                 mensagem=_PROPOSTA.get(toque, _PROPOSTA[3]).format(s=s) if f.get("pode_enviar") else "")
    elif f.get("respostas_automaticas_da_clinica") and not f.get("mensagens_clinica_humanas"):
        r = dict(situacao="so_resposta_automatica", motivo_principal="barrado_por_resposta_automatica",
                 interlocutor="resposta_automatica", proxima_acao="enviar_mensagem", temperatura="frio", score=25,
                 diagnostico="Só houve resposta automática: a mensagem provavelmente não chegou ao decisor.",
                 mensagem=_AUTOMATICA)
    else:
        if not f.get("pode_enviar"):
            r = dict(situacao="sem_resposta", motivo_principal="mensagem_nao_chegou_ao_decisor", proxima_acao="encerrar",
                     temperatura="perdido", score=5, canal_recomendado="nenhum",
                     diagnostico="Cadência completa e reativação feita, sem resposta. Encerrar.")
        elif etapa == "reativacao_estrategica":
            r = dict(situacao="sem_resposta", motivo_principal="mensagem_generica_sem_gancho", proxima_acao="enviar_mensagem",
                     temperatura="frio", score=15, diagnostico="Cadência encerrada sem resposta. Reativação com ângulo novo.",
                     mensagem=_REATIVACAO.format(s=s))
        else:
            toque = int(etapa.rsplit("_", 1)[-1]) if etapa.startswith("cadencia_toque") else 2
            motivo = "barrado_na_recepcao" if f.get("falou_com_porteira") else "mensagem_nao_chegou_ao_decisor"
            r = dict(situacao="sem_resposta", motivo_principal=motivo, proxima_acao="enviar_mensagem",
                     temperatura="frio", score=20, diagnostico="Sem resposta humana. Seguir a cadência com outro ângulo.",
                     mensagem=_TOQUES.get(toque, _TOQUES[3]).format(s=s))
    resultado = {**base, **r}
    resultado["estrategia"] = "Modelo padrão da etapa (sem leitura da conversa)."
    resultado["problemas_de_texto"] = revisar(resultado["mensagem"], etapa) if resultado["mensagem"] else []
    return resultado
