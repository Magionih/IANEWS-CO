"""Estruturas de dados do agente: mensagem, lead e resultado da análise."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime


@dataclass
class Mensagem:
    quando: datetime
    autor: str
    texto: str
    nossa: bool  # True quando foi a Sinmed (Renata) que enviou

    def para_dict(self) -> dict:
        return {
            "quando": self.quando.isoformat(timespec="minutes"),
            "autor": self.autor,
            "texto": self.texto,
            "nossa": self.nossa,
        }


@dataclass
class Lead:
    chave: str  # identificador estável: telefone normalizado, @perfil ou nome
    nome: str
    canal: str  # whatsapp | instagram
    telefone: str = ""
    instagram: str = ""
    origem: str = ""  # arquivo de onde veio (export, planilha)
    lote: str = ""
    etiqueta: str = ""  # ex.: SimMed (WhatsApp Business)
    observacoes: str = ""  # anotações da planilha de prospecção
    mensagens: list[Mensagem] = field(default_factory=list)
    fatos: dict = field(default_factory=dict)  # preenchido pela pré-análise determinística

    def ordenar(self) -> None:
        self.mensagens.sort(key=lambda m: m.quando)

    def transcricao(self) -> str:
        linhas = []
        for m in self.mensagens:
            quem = "SINMED" if m.nossa else f"CLÍNICA ({m.autor})"
            linhas.append(f"[{m.quando:%d/%m/%Y %H:%M}] {quem}: {m.texto}")
        return "\n".join(linhas) if linhas else "(nenhuma mensagem registrada)"

    def para_dict(self) -> dict:
        dados = asdict(self)
        dados["mensagens"] = [m.para_dict() for m in self.mensagens]
        return dados

    @staticmethod
    def de_dict(dados: dict) -> "Lead":
        msgs = [
            Mensagem(datetime.fromisoformat(m["quando"]), m["autor"], m["texto"], m["nossa"])
            for m in dados.get("mensagens", [])
        ]
        campos = {k: v for k, v in dados.items() if k != "mensagens"}
        return Lead(**campos, mensagens=msgs)
