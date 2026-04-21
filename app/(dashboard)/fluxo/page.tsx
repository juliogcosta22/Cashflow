"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { useMobileMenu } from "@/lib/mobile-menu-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Sale, SaleItem, CashTransaction } from "@/types";
import {
  BarChart2, Banknote, CreditCard, Smartphone, Wallet,
  TrendingUp, TrendingDown, ChevronDown, ChevronRight,
  ArrowUpRight, ArrowDownRight, Filter,
} from "lucide-react";

type Period = "today" | "week" | "month" | "custom";

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  debito: "Débito",
  credito: "Crédito",
};

const PAYMENT_ICONS: Record<string, React.ElementType> = {
  dinheiro: Banknote,
  pix: Smartphone,
  debito: CreditCard,
  credito: Wallet,
};

const PAYMENT_COLORS: Record<string, string> = {
  dinheiro: "var(--color-success)",
  pix: "#7c3aed",
  debito: "var(--color-primary)",
  credito: "var(--color-warning)",
};

interface DayGroup {
  date: string;
  sales: (Sale & { items: SaleItem[] })[];
  transactions: CashTransaction[];
  totalIncome: number;
  totalExpense: number;
  totalSales: number;
}

function dateRange(period: Period, from: string, to: string): { start: string; end: string } {
  const today = new Date().toISOString().slice(0, 10);
  switch (period) {
    case "today":
      return { start: today, end: today };
    case "week": {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      return { start: d.toISOString().slice(0, 10), end: today };
    }
    case "month": {
      const d = new Date();
      const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      return { start, end: today };
    }
    case "custom":
      return { start: from, end: to };
  }
}

export default function FluxoPage() {
  const openMenu = useMobileMenu();
  const [period, setPeriod] = useState<Period>("today");
  const [customFrom, setCustomFrom] = useState(new Date().toISOString().slice(0, 10));
  const [customTo, setCustomTo] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<DayGroup[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const { start, end } = dateRange(period, customFrom, customTo);
    const supabase = createClient();

    const [{ data: sales }, { data: txs }] = await Promise.all([
      supabase
        .from("sales")
        .select("*, items:sale_items(*)")
        .gte("date", start)
        .lte("date", end)
        .order("created_at", { ascending: false }),
      supabase
        .from("cash_transactions")
        .select("*")
        .gte("date", start)
        .lte("date", end)
        .order("created_at", { ascending: false }),
    ]);

    // Group by date
    const map = new Map<string, DayGroup>();

    const allDates = new Set<string>();
    (sales || []).forEach((s: Sale) => allDates.add(s.date));
    (txs || []).forEach((t: CashTransaction) => allDates.add(t.date));

    for (const date of [...allDates].sort().reverse()) {
      const daySales = (sales || []).filter((s: Sale) => s.date === date) as (Sale & { items: SaleItem[] })[];
      const dayTxs = (txs || []).filter((t: CashTransaction) => t.date === date) as CashTransaction[];

      const totalSales = daySales.reduce((s, sale) => s + sale.total, 0);
      const manualIncome = dayTxs.filter(t => t.type === "entrada").reduce((s, t) => s + t.amount, 0);
      const totalExpense = dayTxs.filter(t => t.type === "saida").reduce((s, t) => s + t.amount, 0);

      map.set(date, {
        date,
        sales: daySales,
        transactions: dayTxs,
        totalIncome: totalSales + manualIncome,
        totalExpense,
        totalSales,
      });
    }

    const result = [...map.values()];
    setGroups(result);

    // Auto-expand today
    const today = new Date().toISOString().slice(0, 10);
    if (result.some(g => g.date === today)) {
      setExpanded(new Set([today]));
    }

    setLoading(false);
  }, [period, customFrom, customTo]);

  useEffect(() => { load(); }, [load]);

  const totalIncome = groups.reduce((s, g) => s + g.totalIncome, 0);
  const totalExpense = groups.reduce((s, g) => s + g.totalExpense, 0);
  const totalSales = groups.reduce((s, g) => s + g.totalSales, 0);
  const totalSaleCount = groups.reduce((s, g) => s + g.sales.length, 0);

  // Payment method breakdown
  const byPayment: Record<string, number> = {};
  groups.forEach(g => g.sales.forEach(s => {
    byPayment[s.payment_method] = (byPayment[s.payment_method] || 0) + s.total;
  }));

  function toggleExpand(date: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  }

  const PERIODS: { key: Period; label: string }[] = [
    { key: "today", label: "Hoje" },
    { key: "week", label: "7 dias" },
    { key: "month", label: "Este mês" },
    { key: "custom", label: "Período" },
  ];

  return (
    <>
      <Header title="Fluxo de Caixa" subtitle="Relatório de transações" onMenuClick={openMenu} />

      <div className="p-4 md:p-6 flex flex-col gap-5 max-w-7xl mx-auto w-full">
        {/* Period filter */}
        <div className="flex flex-wrap gap-3 items-center">
          <Filter size={15} className="text-[var(--color-text-muted)]" />
          <div className="flex gap-1">
            {PERIODS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`px-3 h-8 text-sm font-medium rounded-[var(--radius-md)] transition-colors duration-150 ${
                  period === key
                    ? "bg-[var(--color-primary)] text-white"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {period === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-8 px-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              />
              <span className="text-[var(--color-text-muted)] text-sm">até</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 px-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Entradas totais", value: formatCurrency(totalIncome), color: "var(--color-income)", icon: TrendingUp },
            { label: "Saídas totais", value: formatCurrency(totalExpense), color: "var(--color-expense)", icon: TrendingDown },
            { label: "Vendas (PDV)", value: formatCurrency(totalSales), color: "var(--color-primary)", icon: BarChart2 },
            { label: "Nº de vendas", value: totalSaleCount.toString(), color: "var(--color-text-primary)", icon: ArrowUpRight },
          ].map(({ label, value, color, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="py-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <Icon size={13} style={{ color }} />
                    <span className="text-xs font-medium text-[var(--color-text-muted)]">{label}</span>
                  </div>
                  <span className="text-xl font-bold tabular-nums" style={{ color }}>
                    {loading ? "—" : value}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Payment method breakdown */}
        {Object.keys(byPayment).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Por forma de pagamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Object.entries(byPayment).map(([method, amount]) => {
                  const Icon = PAYMENT_ICONS[method] || Wallet;
                  const color = PAYMENT_COLORS[method] || "var(--color-primary)";
                  return (
                    <div key={method} className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center flex-shrink-0"
                        style={{ background: `${color}18` }}
                      >
                        <Icon size={18} style={{ color }} />
                      </div>
                      <div>
                        <p className="text-xs text-[var(--color-text-muted)]">{PAYMENT_LABELS[method]}</p>
                        <p className="text-sm font-bold tabular-nums text-[var(--color-text-primary)]">
                          {formatCurrency(amount)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Daily groups */}
        {loading ? (
          <Card>
            <div className="py-16 text-center text-sm text-[var(--color-text-muted)]">Carregando...</div>
          </Card>
        ) : groups.length === 0 ? (
          <Card>
            <EmptyState
              icon={BarChart2}
              title="Nenhuma transação"
              description="Não há movimentações no período selecionado."
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((group) => {
              const isOpen = expanded.has(group.date);
              const isToday = group.date === new Date().toISOString().slice(0, 10);
              const dayBalance = group.totalIncome - group.totalExpense;

              return (
                <Card key={group.date}>
                  {/* Day header */}
                  <button
                    onClick={() => toggleExpand(group.date)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--color-surface-elevated)] rounded-[var(--radius-lg)] transition-colors duration-100"
                  >
                    <div className="flex items-center gap-3">
                      {isOpen
                        ? <ChevronDown size={16} className="text-[var(--color-text-muted)]" />
                        : <ChevronRight size={16} className="text-[var(--color-text-muted)]" />
                      }
                      <div className="text-left">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                          {isToday ? "Hoje — " : ""}{formatDate(group.date)}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {group.sales.length} venda{group.sales.length !== 1 ? "s" : ""}
                          {group.transactions.length > 0 && ` · ${group.transactions.length} lançamento${group.transactions.length !== 1 ? "s" : ""}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <p className="text-xs text-[var(--color-text-muted)]">Entradas</p>
                        <p className="text-sm font-bold tabular-nums text-[var(--color-income)]">
                          +{formatCurrency(group.totalIncome)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--color-text-muted)]">Saídas</p>
                        <p className="text-sm font-bold tabular-nums text-[var(--color-expense)]">
                          -{formatCurrency(group.totalExpense)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--color-text-muted)]">Saldo</p>
                        <p
                          className="text-sm font-bold tabular-nums"
                          style={{ color: dayBalance >= 0 ? "var(--color-income)" : "var(--color-expense)" }}
                        >
                          {formatCurrency(dayBalance)}
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* Expanded items */}
                  {isOpen && (
                    <div className="border-t border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                      {/* PDV Sales */}
                      {group.sales.map((sale) => {
                        const Icon = PAYMENT_ICONS[sale.payment_method] || Wallet;
                        const color = PAYMENT_COLORS[sale.payment_method];
                        return (
                          <div key={sale.id} className="px-5 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0">
                                <div
                                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                                  style={{ background: `${color}18` }}
                                >
                                  <Icon size={14} style={{ color }} />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                                    Venda PDV
                                    <Badge variant="success" className="ml-2">
                                      {PAYMENT_LABELS[sale.payment_method]}
                                    </Badge>
                                  </p>
                                  {sale.items && sale.items.length > 0 && (
                                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                                      {sale.items.map(i =>
                                        `${i.quantity}× ${i.product_name}`
                                      ).join(", ")}
                                    </p>
                                  )}
                                  {sale.note && (
                                    <p className="text-xs text-[var(--color-text-muted)] italic mt-0.5">{sale.note}</p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-sm font-bold tabular-nums text-[var(--color-income)]">
                                  +{formatCurrency(sale.total)}
                                </p>
                                {sale.discount > 0 && (
                                  <p className="text-xs text-[var(--color-text-muted)]">
                                    Desc: -{formatCurrency(sale.discount)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Manual transactions */}
                      {group.transactions.map((tx) => (
                        <div key={tx.id} className="flex items-center gap-3 px-5 py-3">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{
                              background: tx.type === "entrada"
                                ? "var(--color-success-subtle)"
                                : "var(--color-danger-subtle)",
                            }}
                          >
                            {tx.type === "entrada"
                              ? <ArrowUpRight size={14} className="text-[var(--color-income)]" />
                              : <ArrowDownRight size={14} className="text-[var(--color-expense)]" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                              {tx.description}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)]">{tx.category}</p>
                          </div>
                          <span
                            className="text-sm font-bold tabular-nums flex-shrink-0"
                            style={{ color: tx.type === "entrada" ? "var(--color-income)" : "var(--color-expense)" }}
                          >
                            {tx.type === "entrada" ? "+" : "-"}{formatCurrency(tx.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
