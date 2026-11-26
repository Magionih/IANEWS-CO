import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pencil } from "lucide-react";

import { useCrm } from "@/components/crm/context";
import { useAcao } from "@/components/crm/queries";
import {
  BotaoCsv,
  CabecalhoPagina,
  Campo,
  Carregando,
  Erro,
  Etiqueta,
  FaixaNumeros,
  Secao,
  Vazio,
} from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getClientes, saveProduto, type Clientes } from "@/lib/crm/metricas.functions";
import { fmtDia, fmtMoeda, fmtNum, fmtPct, labelDe, PRODUTOS } from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_crm/clientes")({
  component: ClientesPage,
});

/* Camada 5 · Clientes e produtos: LTV, recompra, upsell, indicações, CAC e LTV/CAC,
   e a margem de cada produto (preço − imposto − custo direto). */

type ProdutoLinha = Clientes["produtos"][number];

function ClientesPage() {
  const { isAdmin } = useCrm();
  const fetchCli = useServerFn(getClientes);
  const [editando, setEditando] = useState<ProdutoLinha | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["crm", "clientes-produtos"],
    queryFn: () => fetchCli(),
    enabled: isAdmin,
  });
  if (!isAdmin)
    return (
      <div className="space-y-5">
        <CabecalhoPagina titulo="Clientes e produtos" />
        <Vazio>Só administradores veem os valores por cliente.</Vazio>
      </div>
    );
  if (isLoading) return <Carregando texto="Somando os clientes..." />;
  if (error || !data) return <Erro erro={error} />;

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Clientes e produtos"
        descricao="Visão mensal: quanto cada cliente vale (LTV), quanto custa trazer um novo (CAC) e a margem de cada produto."
        acoes={
          <BotaoCsv
            nome="clientes"
            linhas={data.clientes}
            colunas={[
              { titulo: "Cliente", valor: (c) => c.cliente },
              { titulo: "Compras", valor: (c) => c.compras },
              { titulo: "Total", valor: (c) => c.total },
              { titulo: "Primeira", valor: (c) => c.primeira },
              { titulo: "Última", valor: (c) => c.ultima },
              { titulo: "Produtos", valor: (c) => c.produtos.join(" ") },
            ]}
          />
        }
      />

      <FaixaNumeros
        itens={[
          {
            rotulo: "Clientes pagantes",
            valor: fmtNum(data.totalClientes),
            detalhe: `${data.novos90} novos em 90 dias`,
            tom: "azul",
          },
          { rotulo: "LTV médio", valor: fmtMoeda(data.ltv), detalhe: "total pago por cliente" },
          {
            rotulo: "Recompra",
            valor: fmtPct(data.recompraPct),
            detalhe: `${data.upsell} fizeram upsell`,
          },
          {
            rotulo: "CAC",
            valor: data.cac == null ? "—" : fmtMoeda(data.cac),
            detalhe:
              data.cac == null ? "lance anúncios e comissões" : "investimento ÷ novos (90 dias)",
          },
          {
            rotulo: "LTV / CAC",
            valor: data.ltvCac == null ? "—" : `${data.ltvCac.toFixed(1).replace(".", ",")}x`,
            detalhe: "meta acima de 3x",
            tom: data.ltvCac != null && data.ltvCac < 3 ? "alerta" : undefined,
          },
          {
            rotulo: "Indicações",
            valor: fmtNum(data.indicacoes.leads),
            detalhe: `${data.indicacoes.pagos} viraram venda`,
          },
        ]}
      />

      <Secao
        titulo="Margem por produto"
        colado
        acoes={
          <span className="text-xs text-muted-foreground">
            imposto de {data.aliquota}% já descontado
          </span>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-[13px]">
            <thead className="text-[11.5px] text-muted-foreground">
              <tr className="border-b">
                <th className="px-4 py-2 text-left font-medium">Produto</th>
                <th className="px-2 py-2 text-right font-medium">Preço</th>
                <th className="px-2 py-2 text-right font-medium">Custo direto</th>
                <th className="px-2 py-2 text-right font-medium">Margem</th>
                <th className="px-2 py-2 text-right font-medium">Vendas</th>
                <th className="px-2 py-2 text-right font-medium">Receita</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.produtos.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2">
                    <span className="block font-medium">{p.nome}</span>
                    {p.entregas ? (
                      <span className="block max-w-[280px] truncate text-[11px] text-muted-foreground">
                        {p.entregas}
                      </span>
                    ) : null}
                  </td>
                  <td className="tabular px-2 py-2 text-right">
                    {p.preco == null ? "variável" : fmtMoeda(p.preco)}
                  </td>
                  <td className="tabular px-2 py-2 text-right">
                    {p.custo_direto == null ? (
                      <span className="text-muted-foreground">informe</span>
                    ) : (
                      fmtMoeda(p.custo_direto)
                    )}
                  </td>
                  <td
                    className={cn(
                      "tabular px-2 py-2 text-right font-semibold",
                      p.margemPct != null && p.margemPct < 0.4 && "text-destructive",
                    )}
                  >
                    {fmtPct(p.margemPct)}
                  </td>
                  <td className="tabular px-2 py-2 text-right">{fmtNum(p.vendas)}</td>
                  <td className="tabular px-2 py-2 text-right">{fmtMoeda(p.receita)}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      aria-label="Editar"
                      onClick={() => setEditando(p)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>

      <Secao titulo="Clientes" contagem={data.totalClientes} colado>
        {data.clientes.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-[13px]">
              <thead className="text-[11.5px] text-muted-foreground">
                <tr className="border-b">
                  <th className="px-4 py-2 text-left font-medium">Cliente</th>
                  <th className="px-2 py-2 text-right font-medium">Compras</th>
                  <th className="px-2 py-2 text-right font-medium">Total pago</th>
                  <th className="px-2 py-2 text-left font-medium">Produtos</th>
                  <th className="px-4 py-2 text-right font-medium">Última compra</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.clientes.map((c) => (
                  <tr key={c.chave}>
                    <td className="max-w-[240px] truncate px-4 py-2 font-medium">{c.cliente}</td>
                    <td className="tabular px-2 py-2 text-right">
                      {c.compras}
                      {c.compras > 1 ? (
                        <span className="ml-1.5">
                          <Etiqueta tom="ok">recompra</Etiqueta>
                        </span>
                      ) : null}
                    </td>
                    <td className="tabular px-2 py-2 text-right font-semibold">
                      {fmtMoeda(c.total)}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {c.produtos.map((p) => labelDe(PRODUTOS, p) || p).join(", ") || "—"}
                    </td>
                    <td className="tabular px-4 py-2 text-right">{fmtDia(c.ultima)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5">
            <Vazio>Nenhum cliente pagante ainda.</Vazio>
          </div>
        )}
      </Secao>
      <p className="text-[12px] text-muted-foreground">
        NPS e renovação de planos entram quando houver pesquisa e planos mensais ativos registrados.
      </p>
      <ProdutoDialog produto={editando} onClose={() => setEditando(null)} />
    </div>
  );
}

function ProdutoDialog({
  produto,
  onClose,
}: {
  produto: ProdutoLinha | null;
  onClose: () => void;
}) {
  const salvar = useServerFn(saveProduto);
  const { executar, ocupado } = useAcao();
  const [f, setF] = useState({ preco: "", custo_direto: "", entregas: "" });
  useEffect(() => {
    if (produto)
      setF({
        preco: produto.preco == null ? "" : String(produto.preco).replace(".", ","),
        custo_direto:
          produto.custo_direto == null ? "" : String(produto.custo_direto).replace(".", ","),
        entregas: produto.entregas ?? "",
      });
  }, [produto]);
  return (
    <Dialog open={!!produto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{produto?.nome}</DialogTitle>
          <DialogDescription>
            Custo direto = o que se gasta para entregar uma unidade (produção, freelancer,
            comissão).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Preço (R$)">
            <Input
              inputMode="decimal"
              value={f.preco}
              onChange={(e) => setF((x) => ({ ...x, preco: e.target.value }))}
            />
          </Campo>
          <Campo rotulo="Custo direto (R$)">
            <Input
              inputMode="decimal"
              value={f.custo_direto}
              onChange={(e) => setF((x) => ({ ...x, custo_direto: e.target.value }))}
            />
          </Campo>
          <Campo rotulo="Entregas" className="sm:col-span-2">
            <Input
              value={f.entregas}
              onChange={(e) => setF((x) => ({ ...x, entregas: e.target.value }))}
              placeholder="Ex.: 1 matéria + 1 post collab"
            />
          </Campo>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={ocupado}
            onClick={async () => {
              if (!produto) return;
              const r = await executar(
                () => salvar({ data: { id: produto.id, ...f } }),
                "Produto salvo.",
              );
              if (r) onClose();
            }}
          >
            {ocupado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
