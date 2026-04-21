"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { useMobileMenu } from "@/lib/mobile-menu-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { Product } from "@/types";
import { Calculator, TrendingUp, Package, ChevronRight, AlertTriangle } from "lucide-react";

function MarginBar({ percent }: { percent: number }) {
  const clamped = Math.min(Math.max(percent, 0), 200);
  const color =
    percent >= 50 ? "var(--color-success)" :
    percent >= 25 ? "var(--color-warning)" :
    percent >= 0 ? "var(--color-danger)" : "var(--color-expense)";

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-[var(--color-surface-elevated)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.min(clamped / 2, 100)}%`, background: color }}
        />
      </div>
      <span className="text-sm font-bold tabular-nums w-16 text-right" style={{ color }}>
        {percent.toFixed(1)}%
      </span>
    </div>
  );
}

export default function PrecificacaoPage() {
  const openMenu = useMobileMenu();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("margin_desc");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Simulator state
  const [simCost, setSimCost] = useState("");
  const [simMargin, setSimMargin] = useState("");
  const [simMarkup, setSimMarkup] = useState("");
  const [simSale, setSimSale] = useState("");
  const [simExpenses, setSimExpenses] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.from("products").select("*").order("name");
      setProducts(data || []);
      setLoading(false);
    }
    load();
  }, []);

  // Simulator logic — all fields are derived from each other
  function handleSimCostChange(v: string) {
    setSimCost(v);
    const cost = parseFloat(v) || 0;
    const expenses = parseFloat(simExpenses) || 0;
    if (simMargin) {
      const margin = parseFloat(simMargin) / 100;
      const sale = (cost + expenses) / (1 - margin);
      setSimSale(sale > 0 ? sale.toFixed(2) : "");
      if (cost > 0) setSimMarkup((((sale - cost - expenses) / cost) * 100).toFixed(1));
    } else if (simSale) {
      const sale = parseFloat(simSale);
      const profit = sale - cost - expenses;
      if (sale > 0) setSimMargin(((profit / sale) * 100).toFixed(1));
      if (cost > 0) setSimMarkup(((profit / cost) * 100).toFixed(1));
    }
  }

  function handleSimMarginChange(v: string) {
    setSimMargin(v);
    const cost = parseFloat(simCost) || 0;
    const expenses = parseFloat(simExpenses) || 0;
    const margin = parseFloat(v) / 100;
    if (margin < 1 && margin >= 0 && cost > 0) {
      const sale = (cost + expenses) / (1 - margin);
      setSimSale(sale.toFixed(2));
      setSimMarkup((((sale - cost - expenses) / cost) * 100).toFixed(1));
    }
  }

  function handleSimMarkupChange(v: string) {
    setSimMarkup(v);
    const cost = parseFloat(simCost) || 0;
    const expenses = parseFloat(simExpenses) || 0;
    const markup = parseFloat(v) / 100;
    if (cost > 0 && markup >= 0) {
      const profit = cost * markup;
      const sale = cost + expenses + profit;
      setSimSale(sale.toFixed(2));
      if (sale > 0) setSimMargin((((sale - cost - expenses) / sale) * 100).toFixed(1));
    }
  }

  function handleSimSaleChange(v: string) {
    setSimSale(v);
    const cost = parseFloat(simCost) || 0;
    const expenses = parseFloat(simExpenses) || 0;
    const sale = parseFloat(v) || 0;
    if (sale > 0) {
      const profit = sale - cost - expenses;
      setSimMargin(((profit / sale) * 100).toFixed(1));
      if (cost > 0) setSimMarkup(((profit / cost) * 100).toFixed(1));
    }
  }

  function handleSimExpensesChange(v: string) {
    setSimExpenses(v);
    const cost = parseFloat(simCost) || 0;
    const expenses = parseFloat(v) || 0;
    if (simMargin) {
      const margin = parseFloat(simMargin) / 100;
      if (margin < 1) {
        const sale = (cost + expenses) / (1 - margin);
        setSimSale(sale > 0 ? sale.toFixed(2) : "");
        if (cost > 0) setSimMarkup((((sale - cost - expenses) / cost) * 100).toFixed(1));
      }
    }
  }

  function loadProductIntoSim(product: Product) {
    setSelectedProduct(product);
    setSimCost(product.cost_price.toString());
    setSimExpenses("");
    setSimSale(product.sale_price.toString());
    const profit = product.sale_price - product.cost_price;
    if (product.sale_price > 0) setSimMargin(((profit / product.sale_price) * 100).toFixed(1));
    if (product.cost_price > 0) setSimMarkup(((profit / product.cost_price) * 100).toFixed(1));
  }

  const getMargin = (p: Product) =>
    p.cost_price > 0 ? ((p.sale_price - p.cost_price) / p.cost_price) * 100 : 0;

  const sorted = [...products]
    .filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku || "").toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "margin_desc": return getMargin(b) - getMargin(a);
        case "margin_asc": return getMargin(a) - getMargin(b);
        case "name": return a.name.localeCompare(b.name);
        case "sale_desc": return b.sale_price - a.sale_price;
        default: return 0;
      }
    });

  const avgMargin = products.length > 0
    ? products.reduce((s, p) => s + getMargin(p), 0) / products.length
    : 0;

  const simCostNum = parseFloat(simCost) || 0;
  const simSaleNum = parseFloat(simSale) || 0;
  const simExpensesNum = parseFloat(simExpenses) || 0;
  const simProfit = simSaleNum - simCostNum - simExpensesNum;
  const simMarginNum = parseFloat(simMargin) || 0;

  return (
    <>
      <Header
        title="Precificação"
        subtitle="Analise custos e margens dos seus produtos"
        onMenuClick={openMenu}
      />

      <div className="p-4 md:p-6 flex flex-col gap-5 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Left: Products list */}
          <div className="xl:col-span-2 flex flex-col gap-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Produtos", value: products.length.toString(), icon: Package, color: "var(--color-primary)" },
                { label: "Margem média", value: `${avgMargin.toFixed(1)}%`, icon: TrendingUp, color: avgMargin >= 30 ? "var(--color-success)" : "var(--color-warning)" },
                {
                  label: "Abaixo de 10%",
                  value: products.filter((p) => getMargin(p) < 10).length.toString(),
                  icon: AlertTriangle,
                  color: "var(--color-danger)",
                },
              ].map(({ label, value, icon: Icon, color }) => (
                <Card key={label}>
                  <CardContent className="py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <Icon size={13} style={{ color }} />
                        <span className="text-xs font-medium text-[var(--color-text-muted)]">{label}</span>
                      </div>
                      <span className="text-xl font-bold tabular-nums" style={{ color }}>{value}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Controls */}
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-48 relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input
                  type="search"
                  placeholder="Buscar produto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-9 px-3 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              >
                <option value="margin_desc">Maior margem</option>
                <option value="margin_asc">Menor margem</option>
                <option value="name">Nome A-Z</option>
                <option value="sale_desc">Maior preço</option>
              </select>
            </div>

            {/* Products */}
            <Card>
              {loading ? (
                <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">Carregando...</div>
              ) : sorted.length === 0 ? (
                <EmptyState
                  icon={Calculator}
                  title="Nenhum produto"
                  description="Cadastre produtos no Estoque para analisar aqui."
                />
              ) : (
                <div className="divide-y divide-[var(--color-border)]">
                  {sorted.map((product) => {
                    const margin = getMargin(product);
                    const isSelected = selectedProduct?.id === product.id;
                    return (
                      <button
                        key={product.id}
                        onClick={() => loadProductIntoSim(product)}
                        className={`w-full text-left px-5 py-4 flex flex-col gap-2 transition-colors duration-100 ${
                          isSelected
                            ? "bg-[var(--color-primary-subtle)]"
                            : "hover:bg-[var(--color-surface-elevated)]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{product.name}</p>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-[var(--color-text-muted)]">
                              <span>Custo: {formatCurrency(product.cost_price)}</span>
                              <span>·</span>
                              <span>Venda: {formatCurrency(product.sale_price)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant={margin >= 30 ? "success" : margin >= 10 ? "warning" : "danger"}>
                              {margin.toFixed(1)}%
                            </Badge>
                            <ChevronRight size={14} className="text-[var(--color-text-muted)]" />
                          </div>
                        </div>
                        <MarginBar percent={margin} />
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Right: Simulator */}
          <div className="xl:col-span-1">
            <div className="sticky top-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Calculator size={16} className="text-[var(--color-primary)]" />
                    <CardTitle>Simulador de preço</CardTitle>
                  </div>
                  {selectedProduct && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      Baseado em: <strong className="text-[var(--color-text-secondary)]">{selectedProduct.name}</strong>
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-4">
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Altere qualquer campo — os demais serão recalculados automaticamente.
                    </p>

                    <Input
                      label="Custo do produto"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      prefix="R$"
                      value={simCost}
                      onChange={(e) => handleSimCostChange(e.target.value)}
                    />

                    <Input
                      label="Despesas adicionais"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      prefix="R$"
                      helper="Embalagem, frete, comissão, etc."
                      value={simExpenses}
                      onChange={(e) => handleSimExpensesChange(e.target.value)}
                    />

                    <div className="h-px bg-[var(--color-border)]" />

                    <Input
                      label="Margem desejada (%)"
                      type="number"
                      min="0"
                      max="99"
                      step="0.1"
                      placeholder="ex: 30"
                      value={simMargin}
                      onChange={(e) => handleSimMarginChange(e.target.value)}
                      helper="Lucro ÷ preço de venda"
                    />

                    <Input
                      label="Markup (%)"
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="ex: 50"
                      value={simMarkup}
                      onChange={(e) => handleSimMarkupChange(e.target.value)}
                      helper="Lucro ÷ custo"
                    />

                    <Input
                      label="Preço de venda"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      prefix="R$"
                      value={simSale}
                      onChange={(e) => handleSimSaleChange(e.target.value)}
                    />

                    {/* Results */}
                    {simSaleNum > 0 && simCostNum > 0 && (
                      <div className="mt-1 flex flex-col gap-3 p-4 rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)] border border-[var(--color-border)]">
                        <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                          Resultado
                        </p>
                        <div className="flex flex-col gap-2">
                          {[
                            { label: "Custo", value: formatCurrency(simCostNum), color: undefined },
                            { label: "Despesas", value: formatCurrency(simExpensesNum), color: undefined },
                            { label: "Lucro por unidade", value: formatCurrency(simProfit), color: simProfit >= 0 ? "var(--color-success)" : "var(--color-danger)" },
                            { label: "Margem (Venda)", value: `${simMarginNum.toFixed(1)}%`, color: simMarginNum >= 30 ? "var(--color-success)" : simMarginNum >= 10 ? "var(--color-warning)" : "var(--color-danger)" },
                          ].map(({ label, value, color }) => (
                            <div key={label} className="flex items-center justify-between">
                              <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
                              <span
                                className="text-sm font-bold tabular-nums"
                                style={{ color: color || "var(--color-text-primary)" }}
                              >
                                {value}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="mt-1">
                          <p className="text-xs text-[var(--color-text-muted)] mb-2">
                            Margem sobre venda
                          </p>
                          <MarginBar percent={simMarginNum} />
                        </div>

                        {simMarginNum < 10 && (
                          <div className="flex items-center gap-2 mt-1">
                            <AlertTriangle size={13} className="text-[var(--color-danger)]" />
                            <p className="text-xs text-[var(--color-danger)]">
                              Margem baixa. Revise os custos ou aumente o preço.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
