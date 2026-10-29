import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { useCrm } from "./context";
import { useEmpresas, usePessoas } from "./queries";

/* Seletores com busca: empresa, pessoa e responsável da equipe. */

type Opcao = { id: string; nome: string; detalhe?: string | null };

function Seletor({
  valor,
  onChange,
  opcoes,
  placeholder,
  carregando,
  criar,
  vazioPermitido = true,
}: {
  valor: string | null;
  onChange: (id: string | null) => void;
  opcoes: Opcao[];
  placeholder: string;
  carregando?: boolean;
  /** Mostra "Criar <busca>" quando nada é encontrado. */
  criar?: (nome: string) => void;
  vazioPermitido?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const atual = opcoes.find((o) => o.id === valor);
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="h-10 w-full justify-between font-normal"
        >
          <span className={cn("truncate", !atual && "text-muted-foreground")}>
            {atual ? atual.nome : carregando ? "Carregando..." : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[260px] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Buscar..." value={busca} onValueChange={setBusca} />
          <CommandList>
            <CommandEmpty>
              {criar && busca.trim() ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary"
                  onClick={() => {
                    criar(busca.trim());
                    setAberto(false);
                    setBusca("");
                  }}
                >
                  <Plus className="h-4 w-4" /> Criar “{busca.trim()}”
                </button>
              ) : (
                "Nada encontrado."
              )}
            </CommandEmpty>
            <CommandGroup>
              {vazioPermitido && valor ? (
                <CommandItem
                  value="__nenhum__"
                  onSelect={() => {
                    onChange(null);
                    setAberto(false);
                  }}
                >
                  <span className="text-muted-foreground">Nenhum</span>
                </CommandItem>
              ) : null}
              {opcoes.map((o) => (
                <CommandItem
                  key={o.id}
                  value={`${o.nome} ${o.detalhe ?? ""} ${o.id}`}
                  onSelect={() => {
                    onChange(o.id);
                    setAberto(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", valor === o.id ? "opacity-100" : "opacity-0")}
                  />
                  <span className="truncate">{o.nome}</span>
                  {o.detalhe ? (
                    <span className="ml-auto truncate pl-2 text-xs text-muted-foreground">
                      {o.detalhe}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function EmpresaPicker(props: {
  valor: string | null;
  onChange: (id: string | null) => void;
  criar?: (nome: string) => void;
}) {
  const { data, isLoading } = useEmpresas();
  const opcoes = useMemo(
    () =>
      (data ?? [])
        .filter((e) => e.ativo || e.id === props.valor)
        .map((e) => ({ id: e.id, nome: e.nome, detalhe: e.grupo ? `grupo ${e.grupo}` : null })),
    [data, props.valor],
  );
  return (
    <Seletor {...props} opcoes={opcoes} carregando={isLoading} placeholder="Escolher empresa" />
  );
}

export function PessoaPicker(props: {
  valor: string | null;
  onChange: (id: string | null) => void;
  /** Mostra primeiro as pessoas desta empresa. */
  empresaId?: string | null;
  criar?: (nome: string) => void;
}) {
  const { data, isLoading } = usePessoas();
  const opcoes = useMemo(() => {
    const lista = (data ?? []).filter((p) => p.ativo || p.id === props.valor);
    const daEmpresa = (p: (typeof lista)[number]) =>
      props.empresaId ? p.empresas.some((e) => e.id === props.empresaId) : false;
    return [...lista]
      .sort((a, b) => Number(daEmpresa(b)) - Number(daEmpresa(a)) || a.nome.localeCompare(b.nome))
      .map((p) => ({
        id: p.id,
        nome: p.nome,
        detalhe: p.empresas.map((e) => e.nome).join(", ") || p.email,
      }));
  }, [data, props.valor, props.empresaId]);
  return (
    <Seletor {...props} opcoes={opcoes} carregando={isLoading} placeholder="Escolher pessoa" />
  );
}

export function MembroSelect({
  valor,
  onChange,
  incluirTodos,
  placeholder = "Responsável",
}: {
  valor: string | null;
  onChange: (id: string | null) => void;
  incluirTodos?: boolean;
  placeholder?: string;
}) {
  const { equipe } = useCrm();
  return (
    <Select
      value={valor ?? (incluirTodos ? "todos" : "ninguem")}
      onValueChange={(v) => onChange(v === "ninguem" || v === "todos" ? null : v)}
    >
      <SelectTrigger className="h-10">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {incluirTodos ? (
          <SelectItem value="todos">Toda a equipe</SelectItem>
        ) : (
          <SelectItem value="ninguem">Sem responsável</SelectItem>
        )}
        {equipe.map((m) => (
          <SelectItem key={m.user_id} value={m.user_id}>
            {m.nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
