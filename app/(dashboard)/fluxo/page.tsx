"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { useMobileMenu } from "@/lib/mobile-menu-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, localToday } from "@/lib/utils";
import type { Sale, SaleItem, CashTransaction, PaymentMethod } from "@/types";
import {
  BarChart2, Banknote, CreditCard, Smartphone, Wallet,
  TrendingUp, TrendingDown, ChevronDown, ChevronRight,
  ArrowUpRight, ArrowDownRight, Filter, Pencil, Trash2,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

type Period = "today" | "week" | "month" | "custom";

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "PIX", debito: "Débito", credito: "Crédito",
};
const PAYMENT_ICONS: Record<string, React.ElementType> = {
  dinheiro: Banknote, pix: Smartphone, debito: CreditCard, credito: Wallet,
};
const PAYMENT_COLORS: Record<string, string> = {
  dinheiro: "var(--color-success)", pix: "#7c3aed",
  debito: "var(--color-primary)", credito: "var(--color-warning)",
};
const PAYMENT_METHODS: PaymentMethod[] = ["dinheiro", "pix", "debito", "credito"];

const INCOME_CATEGORIES = [
  "Venda de produtos", "Venda de serviços", "Recebimento de clientes", "Investimento", "Outros",
];
const EXPENSE_CATEGORIES = [
  "Compra de mercadoria", "Aluguel", "Salários", "Contas (água/luz/internet)",
  "Impostos", "Fornecedores", "Outros",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

interface DayGroup {
  date: string;
  sales: (Sale & { items: SaleItem[] })[];
  transactions: CashTransaction[];
  totalIncome: number;
  totalExpense: number;
  totalSales: number;
}

function localDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateRange(period: Period, from: string, to: string) {
  const today = localToday();
  switch (period) {
    case "today":  return { start: today, end: today };
    case "week":   return { start: localDateOffset(-6), end: today };
    case "month": {
      const d = new Date();
      return { start: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`, end: today };
    }
    case "custom": return { start: from, end: to };
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FluxoPage() {
  const openMenu = useMobileMenu();
  const { toast } = useToast();

  // Filter state
  const [period, setPeriod] = useState<Period>("today");
  const [customFrom, setCustomFrom] = useState(localToday);
  const [customTo, setCustomTo] = useState(localToday);

  // Data
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<DayGroup[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Edit/delete modals
  type EditTarget = { kind: "tx"; data: CashTransaction } | { kind: "sale"; data: Sale & { items: SaleItem[] } };
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EditTarget | null>(null);
  const [saving, setSaving] = useState(false);

  // Tx edit form
  const [txForm, setTxForm] = useState({
    type: "entrada" as "entrada" | "saida",
    category: "",
    description: "",
    amount: "",
    date: "",
  });

  // Sale edit form
  const [saleForm, setSaleForm] = useState({
    payment_method: "dinheiro" as PaymentMethod,
    total: "",
    discount: "",
    note: "",
    date: "",
  });

  // ── Data loading ──────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    const { start, end } = dateRange(period, customFrom, customTo);
    const supabase = createClient();

    const [{ data: sales }, { data: txs }] = await Promise.all([
      supabase.from("sales").select("*, items:sale_items(*)").gte("date", start).lte("date", end).order("created_at", { ascending: false }),
      supabase.from("cash_transactions").select("*").gte("date", start).lte("date", end).order("created_at", { ascending: false }),
    ]);

    const allDates = new Set<string>();
    (sales || []).forEach((s: Sale) => allDates.add(s.date));
    (txs || []).forEach((t: CashTransaction) => allDates.add(t.date));

    const map = new Map<string, DayGroup>();
    for (const date of [...allDates].sort().reverse()) {
      const daySales = (sales || []).filter((s: Sale) => s.date === date) as (Sale & { items: SaleItem[] })[];
      const dayTxs  = (txs  || []).filter((t: CashTransaction) => t.date === date) as CashTransaction[];
      const totalSales   = daySales.reduce((s, x) => s + x.total, 0);
      const manualIncome = dayTxs.filter(t => t.type === "entrada").reduce((s, t) => s + t.amount, 0);
      const totalExpense = dayTxs.filter(t => t.type === "saida").reduce((s, t) => s + t.amount, 0);
      map.set(date, { date, sales: daySales, transactions: dayTxs, totalIncome: totalSales + manualIncome, totalExpense, totalSales });
    }

    const result = [...map.values()];
    setGroups(result);

    const today = localToday();
    if (result.some(g => g.date === today)) setExpanded(new Set([today]));
    setLoading(false);
  }, [period, customFrom, customTo]);

  useEffect(() => { load(); }, [load]);

  // ── Edit helpers ──────────────────────────────────────────────────────────

  function openEditTx(tx: CashTransaction) {
    setTxForm({
      type: tx.type,
      category: tx.category,
      description: tx.description,
      amount: tx.amount.toString(),
      date: tx.date,
    });
    setEditTarget({ kind: "tx", data: tx });
  }

  function openEditSale(sale: Sale & { items: SaleItem[] }) {
    setSaleForm({
      payment_method: sale.payment_method,
      total: sale.total.toString(),
      discount: sale.discount > 0 ? sale.discount.toString() : "",
      note: sale.note || "",
      date: sale.date,
    });
    setEditTarget({ kind: "sale", data: sale });
  }

  async function handleSaveTx(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget || editTarget.kind !== "tx") return;
    const amount = parseFloat(txForm.amount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) { toast("error", "Valor inválido."); return; }

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("cash_transactions")
      .update({
        type: txForm.type,
        category: txForm.category || "Outros",
        description: txForm.description.trim(),
        amount,
        date: txForm.date,
      })
      .eq("id", editTarget.data.id);

    setSaving(false);
    if (error) { toast("error", "Erro ao salvar."); return; }
    toast("success", "Lançamento atualizado!");
    setEditTarget(null);
    load();
  }

  async function handleSaveSale(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget || editTarget.kind !== "sale") return;
    const total    = parseFloat(saleForm.total.replace(",", "."));
    const discount = parseFloat(saleForm.discount || "0");
    if (isNaN(total) || total < 0) { toast("error", "Valor inválido."); return; }

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("sales")
      .update({
        payment_method: saleForm.payment_method,
        total,
        discount,
        note: saleForm.note || null,
        date: saleForm.date,
      })
      .eq("id", editTarget.data.id);

    setSaving(false);
    if (error) { toast("error", "Erro ao salvar."); return; }
    toast("success", "Venda atualizada!");
    setEditTarget(null);
    load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    const supabase = createClient();

    if (deleteTarget.kind === "tx") {
      await supabase.from("cash_transactions").delete().eq("id", deleteTarget.data.id);
    } else {
      await supabase.from("sale_items").delete().eq("sale_id", deleteTarget.data.id);
      await supabase.from("sales").delete().eq("id", deleteTarget.data.id);
    }

    setSaving(false);
    setDeleteTarget(null);
    toast("success", "Excluído com sucesso.");
    load();
  }

  // ── Derived totals ────────────────────────────────────────────────────────

  const totalIncome   = groups.reduce((s, g) => s + g.totalIncome, 0);
  const totalExpense  = groups.reduce((s, g) => s + g.totalExpense, 0);
  const totalSales    = groups.reduce((s, g) => s + g.totalSales, 0);
  const totalSaleCount = groups.reduce((s, g) => s + g.sales.length, 0);

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

  const txCategories = txForm.type === "entrada" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const PERIODS: { key: Period; label: string }[] = [
    { key: "today", label: "Hoje" }, { key: "week", label: "7 dias" },
    { key: "month", label: "Este mês" }, { key: "custom", label: "Período" },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Header title="Fluxo de Caixa" subtitle="Relatório de transações" onMenuClick={openMenu} />

      <div className="p-4 md:p-6 flex flex-col gap-5 max-w-7xl mx-auto w-full">

        {/* Period filter */}
        <div className="flex flex-wrap gap-3 items-center">
          <Filter size={15} className="text-[var(--color-text-muted)]" />
          <div className="flex gap-1">
            {PERIODS.map(({ key, label }) => (
              <button key={key} onClick={() => setPeriod(key)}
                className={`px-3 h-8 text-sm font-medium rounded-[var(--radius-md)] transition-colors duration-150 ${
                  period === key
                    ? "bg-[var(--color-primary)] text-white"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]"
                }`}
              >{label}</button>
            ))}
          </div>
          {period === "custom" && (
            <div className="flex items-center gap-2 flex-wrap">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="h-8 px-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]" />
              <span className="text-[var(--color-text-muted)] text-sm">até</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="h-8 px-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]" />
            </div>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Entradas totais", value: formatCurrency(totalIncome),  color: "var(--color-income)",       icon: TrendingUp },
            { label: "Saídas totais",   value: formatCurrency(totalExpense), color: "var(--color-expense)",      icon: TrendingDown },
            { label: "Vendas (PDV)",    value: formatCurrency(totalSales),   color: "var(--color-primary)",      icon: BarChart2 },
            { label: "Nº de vendas",    value: totalSaleCount.toString(),    color: "var(--color-text-primary)", icon: ArrowUpRight },
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

        {/* Payment breakdown */}
        {Object.keys(byPayment).length > 0 && (
          <Card>
            <CardHeader><CardTitle>Por forma de pagamento</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Object.entries(byPayment).map(([method, amount]) => {
                  const Icon  = PAYMENT_ICONS[method]  || Wallet;
                  const color = PAYMENT_COLORS[method] || "var(--color-primary)";
                  return (
                    <div key={method} className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center flex-shrink-0"
                        style={{ background: `${color}18` }}>
                        <Icon size={18} style={{ color }} />
                      </div>
                      <div>
                        <p className="text-xs text-[var(--color-text-muted)]">{PAYMENT_LABELS[method]}</p>
                        <p className="text-sm font-bold tabular-nums text-[var(--color-text-primary)]">{formatCurrency(amount)}</p>
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
          <Card><div className="py-16 text-center text-sm text-[var(--color-text-muted)]">Carregando...</div></Card>
        ) : groups.length === 0 ? (
          <Card><EmptyState icon={BarChart2} title="Nenhuma transação" description="Não há movimentações no período selecionado." /></Card>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map(group => {
              const isOpen    = expanded.has(group.date);
              const isToday   = group.date === localToday();
              const dayBalance = group.totalIncome - group.totalExpense;

              return (
                <Card key={group.date}>
                  {/* Day header */}
                  <button onClick={() => toggleExpand(group.date)}
                    className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-4 hover:bg-[var(--color-surface-elevated)] rounded-[var(--radius-lg)] transition-colors duration-100 text-left">
                    <div className="flex items-center gap-3 min-w-0">
                      {isOpen
                        ? <ChevronDown  size={16} className="text-[var(--color-text-muted)] flex-shrink-0" />
                        : <ChevronRight size={16} className="text-[var(--color-text-muted)] flex-shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                          {isToday ? "Hoje — " : ""}{formatDate(group.date)}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {group.sales.length} venda{group.sales.length !== 1 ? "s" : ""}
                          {group.transactions.length > 0 && ` · ${group.transactions.length} lançamento${group.transactions.length !== 1 ? "s" : ""}`}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 sm:flex sm:items-center sm:gap-6 gap-2 pl-7 sm:pl-0">
                      {[
                        { label: "Entradas", value: `+${formatCurrency(group.totalIncome)}`,  color: "var(--color-income)" },
                        { label: "Saídas",   value: `-${formatCurrency(group.totalExpense)}`, color: "var(--color-expense)" },
                        { label: "Saldo",    value: formatCurrency(dayBalance),               color: dayBalance >= 0 ? "var(--color-income)" : "var(--color-expense)" },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="text-left sm:text-right">
                          <p className="text-[10px] sm:text-xs text-[var(--color-text-muted)]">{label}</p>
                          <p className="text-xs sm:text-sm font-bold tabular-nums truncate" style={{ color }}>{value}</p>
                        </div>
                      ))}
                    </div>
                  </button>

                  {/* Expanded rows */}
                  {isOpen && (
                    <div className="border-t border-[var(--color-border)] divide-y divide-[var(--color-border)]">

                      {/* PDV sales */}
                      {group.sales.map(sale => {
                        const Icon  = PAYMENT_ICONS[sale.payment_method]  || Wallet;
                        const color = PAYMENT_COLORS[sale.payment_method] || "var(--color-primary)";
                        return (
                          <div key={sale.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--color-surface-elevated)] group transition-colors duration-100">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                              style={{ background: `${color}18` }}>
                              <Icon size={14} style={{ color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                                Venda PDV <Badge variant="success" className="ml-1">{PAYMENT_LABELS[sale.payment_method]}</Badge>
                              </p>
                              {sale.items && sale.items.length > 0 && (
                                <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                                  {sale.items.map(i => `${i.quantity}× ${i.product_name}`).join(", ")}
                                </p>
                              )}
                              {sale.note && <p className="text-xs text-[var(--color-text-muted)] italic mt-0.5">{sale.note}</p>}
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <div className="text-right mr-1">
                                <p className="text-sm font-bold tabular-nums text-[var(--color-income)]">+{formatCurrency(sale.total)}</p>
                                {sale.discount > 0 && <p className="text-xs text-[var(--color-text-muted)]">Desc: -{formatCurrency(sale.discount)}</p>}
                              </div>
                              <button onClick={() => openEditSale(sale)} aria-label="Editar venda"
                                className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] opacity-0 group-hover:opacity-100 transition-all duration-150">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => setDeleteTarget({ kind: "sale", data: sale })} aria-label="Excluir venda"
                                className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] opacity-0 group-hover:opacity-100 transition-all duration-150">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {/* Manual transactions */}
                      {group.transactions.map(tx => (
                        <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-surface-elevated)] group transition-colors duration-100">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: tx.type === "entrada" ? "var(--color-success-subtle)" : "var(--color-danger-subtle)" }}>
                            {tx.type === "entrada"
                              ? <ArrowUpRight   size={14} className="text-[var(--color-income)]"  />
                              : <ArrowDownRight size={14} className="text-[var(--color-expense)]" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{tx.description}</p>
                            <p className="text-xs text-[var(--color-text-muted)]">{tx.category}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-sm font-bold tabular-nums mr-1"
                              style={{ color: tx.type === "entrada" ? "var(--color-income)" : "var(--color-expense)" }}>
                              {tx.type === "entrada" ? "+" : "-"}{formatCurrency(tx.amount)}
                            </span>
                            <button onClick={() => openEditTx(tx)} aria-label="Editar lançamento"
                              className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] opacity-0 group-hover:opacity-100 transition-all duration-150">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => setDeleteTarget({ kind: "tx", data: tx })} aria-label="Excluir lançamento"
                              className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] opacity-0 group-hover:opacity-100 transition-all duration-150">
                              <Trash2 size={14} />
                            </button>
                          </div>
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

      {/* ── Edit cash transaction modal ── */}
      <Modal
        open={editTarget?.kind === "tx"}
        onClose={() => setEditTarget(null)}
        title="Editar lançamento"
      >
        <form onSubmit={handleSaveTx} className="flex flex-col gap-4" noValidate>
          {/* Type toggle */}
          <div className="flex gap-2">
            {(["entrada", "saida"] as const).map(t => (
              <button key={t} type="button"
                onClick={() => setTxForm(f => ({ ...f, type: t, category: "" }))}
                className={`flex-1 h-9 text-sm font-medium rounded-[var(--radius-md)] border transition-colors duration-150 ${
                  txForm.type === t
                    ? t === "entrada"
                      ? "bg-[var(--color-success-subtle)] border-[var(--color-success)]/40 text-[var(--color-success)]"
                      : "bg-[var(--color-danger-subtle)] border-[var(--color-danger)]/40 text-[var(--color-danger)]"
                    : "bg-transparent border-[var(--color-border)] text-[var(--color-text-muted)]"
                }`}>
                {t === "entrada" ? "Entrada" : "Saída"}
              </button>
            ))}
          </div>

          <Select
            label="Categoria"
            value={txForm.category}
            onChange={e => setTxForm(f => ({ ...f, category: e.target.value }))}
            options={[{ value: "", label: "Selecione..." }, ...txCategories.map(c => ({ value: c, label: c }))]}
          />

          <Input
            label="Descrição"
            required
            value={txForm.description}
            onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Valor"
              required type="number" min="0.01" step="0.01" prefix="R$"
              value={txForm.amount}
              onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))}
            />
            <Input
              label="Data"
              required type="date"
              value={txForm.date}
              onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditTarget(null)}>Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1">Salvar</Button>
          </div>
        </form>
      </Modal>

      {/* ── Edit sale modal ── */}
      <Modal
        open={editTarget?.kind === "sale"}
        onClose={() => setEditTarget(null)}
        title="Editar venda PDV"
      >
        <form onSubmit={handleSaveSale} className="flex flex-col gap-4" noValidate>
          {/* Payment method */}
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)] mb-2">Forma de pagamento</p>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map(m => {
                const Icon  = PAYMENT_ICONS[m];
                const color = PAYMENT_COLORS[m];
                return (
                  <button key={m} type="button" onClick={() => setSaleForm(f => ({ ...f, payment_method: m }))}
                    className={`flex items-center gap-2 px-3 h-10 rounded-[var(--radius-md)] border text-sm font-medium transition-colors duration-150 ${
                      saleForm.payment_method === m
                        ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
                        : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]/50"
                    }`}>
                    <Icon size={15} style={{ color }} />
                    {PAYMENT_LABELS[m]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Total recebido"
              required type="number" min="0" step="0.01" prefix="R$"
              value={saleForm.total}
              onChange={e => setSaleForm(f => ({ ...f, total: e.target.value }))}
            />
            <Input
              label="Desconto"
              type="number" min="0" step="0.01" prefix="R$"
              value={saleForm.discount}
              onChange={e => setSaleForm(f => ({ ...f, discount: e.target.value }))}
            />
          </div>

          <Input
            label="Data"
            required type="date"
            value={saleForm.date}
            onChange={e => setSaleForm(f => ({ ...f, date: e.target.value }))}
          />

          <Input
            label="Observação"
            type="text" placeholder="Opcional"
            value={saleForm.note}
            onChange={e => setSaleForm(f => ({ ...f, note: e.target.value }))}
          />

          {/* Items (read-only preview) */}
          {editTarget?.kind === "sale" && editTarget.data.items && editTarget.data.items.length > 0 && (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
              <p className="text-xs font-semibold text-[var(--color-text-muted)] px-3 py-2 bg-[var(--color-surface-elevated)] uppercase tracking-wide">
                Itens da venda
              </p>
              <div className="divide-y divide-[var(--color-border)]">
                {editTarget.data.items.map(item => (
                  <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-[var(--color-text-primary)]">
                      {item.quantity}× {item.product_name}
                    </span>
                    <span className="tabular-nums text-[var(--color-text-secondary)]">{formatCurrency(item.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditTarget(null)}>Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1">Salvar</Button>
          </div>
        </form>
      </Modal>

      {/* ── Delete confirmation modal ── */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Excluir transação"
        size="sm"
      >
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          {deleteTarget?.kind === "sale"
            ? "Tem certeza que deseja excluir esta venda PDV? Os itens também serão removidos."
            : "Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita."
          }
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" loading={saving} onClick={handleDelete}>Excluir</Button>
        </div>
      </Modal>
    </>
  );
}
