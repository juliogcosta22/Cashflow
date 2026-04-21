"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { useMobileMenu } from "@/lib/mobile-menu-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { CashTransaction } from "@/types";
import { Plus, Wallet, ArrowUpRight, ArrowDownRight, Trash2, Filter } from "lucide-react";

const INCOME_CATEGORIES = [
  "Venda de produtos",
  "Venda de serviços",
  "Recebimento de clientes",
  "Investimento",
  "Outros",
];

const EXPENSE_CATEGORIES = [
  "Compra de mercadoria",
  "Aluguel",
  "Salários",
  "Contas (água/luz/internet)",
  "Impostos",
  "Fornecedores",
  "Outros",
];

const FILTER_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "entrada", label: "Entradas" },
  { value: "saida", label: "Saídas" },
];

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date();
  d.setMonth(d.getMonth() - i);
  return {
    value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
  };
});

export default function CaixaPage() {
  const openMenu = useMobileMenu();
  const { toast } = useToast();

  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("todos");
  const [filterMonth, setFilterMonth] = useState(MONTH_OPTIONS[0].value);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    type: "entrada" as "entrada" | "saida",
    category: "",
    description: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
  });
  const [formError, setFormError] = useState<string | null>(null);

  async function loadTransactions() {
    const supabase = createClient();
    const [year, month] = filterMonth.split("-");
    const start = `${year}-${month}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const end = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;

    let query = supabase
      .from("cash_transactions")
      .select("*")
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (filterType !== "todos") {
      query = query.eq("type", filterType);
    }

    const { data, error } = await query;
    if (!error) setTransactions(data || []);
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    loadTransactions();
  }, [filterType, filterMonth]);

  function openNewTransaction(type: "entrada" | "saida") {
    setForm({
      type,
      category: "",
      description: "",
      amount: "",
      date: new Date().toISOString().slice(0, 10),
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description.trim() || !form.amount || !form.date) {
      setFormError("Preencha todos os campos obrigatórios.");
      return;
    }
    const amount = parseFloat(form.amount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) {
      setFormError("Valor deve ser maior que zero.");
      return;
    }

    setSaving(true);
    setFormError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("cash_transactions").insert({
      type: form.type,
      category: form.category || "Outros",
      description: form.description.trim(),
      amount,
      date: form.date,
      company_id: user?.id,
    });

    setSaving(false);
    if (error) {
      setFormError("Erro ao salvar. Tente novamente.");
      return;
    }

    setModalOpen(false);
    toast("success", `${form.type === "entrada" ? "Entrada" : "Saída"} registrada com sucesso!`);
    loadTransactions();
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.from("cash_transactions").delete().eq("id", id);
    setDeleting(false);
    setDeleteId(null);

    if (error) {
      toast("error", "Erro ao excluir transação.");
      return;
    }
    toast("success", "Transação excluída.");
    loadTransactions();
  }

  const totalIncome = transactions.filter((t) => t.type === "entrada").reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter((t) => t.type === "saida").reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const categories = form.type === "entrada" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <>
      <Header
        title="Caixa"
        subtitle="Controle de entradas e saídas"
        onMenuClick={openMenu}
      >
        <div className="flex gap-2">
          <Button size="sm" variant="success" onClick={() => openNewTransaction("entrada")}>
            <Plus size={14} />
            <span className="hidden sm:inline">Entrada</span>
          </Button>
          <Button size="sm" variant="danger" onClick={() => openNewTransaction("saida")}>
            <Plus size={14} />
            <span className="hidden sm:inline">Saída</span>
          </Button>
        </div>
      </Header>

      <div className="p-4 md:p-6 flex flex-col gap-5 max-w-7xl mx-auto w-full">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Entradas", value: totalIncome, color: "var(--color-income)", icon: ArrowUpRight },
            { label: "Saídas", value: totalExpense, color: "var(--color-expense)", icon: ArrowDownRight },
            { label: "Saldo", value: balance, color: balance >= 0 ? "var(--color-income)" : "var(--color-expense)", icon: Wallet },
          ].map(({ label, value, color, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="py-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <Icon size={13} style={{ color }} />
                    <span className="text-xs font-medium text-[var(--color-text-muted)]">{label}</span>
                  </div>
                  <span className="text-lg font-bold tabular-nums" style={{ color }}>
                    {formatCurrency(value)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <Filter size={15} className="text-[var(--color-text-muted)]" />
          <div className="flex gap-1">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilterType(opt.value)}
                className={`px-3 h-8 text-sm font-medium rounded-[var(--radius-md)] transition-colors duration-150 ${
                  filterType === opt.value
                    ? "bg-[var(--color-primary)] text-white"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="h-8 px-3 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
          >
            {MONTH_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Transactions list */}
        <Card>
          {loading ? (
            <div className="py-16 flex items-center justify-center">
              <div className="text-sm text-[var(--color-text-muted)]">Carregando...</div>
            </div>
          ) : transactions.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Nenhuma transação"
              description="Registre entradas e saídas para visualizar o fluxo de caixa."
              action={
                <Button size="sm" onClick={() => openNewTransaction("entrada")}>
                  <Plus size={14} /> Nova entrada
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-[var(--color-surface-elevated)] transition-colors duration-100 group"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: tx.type === "entrada" ? "var(--color-success-subtle)" : "var(--color-danger-subtle)" }}
                  >
                    {tx.type === "entrada"
                      ? <ArrowUpRight size={16} className="text-[var(--color-income)]" />
                      : <ArrowDownRight size={16} className="text-[var(--color-expense)]" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{tx.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant={tx.type === "entrada" ? "success" : "danger"}>
                        {tx.type === "entrada" ? "Entrada" : "Saída"}
                      </Badge>
                      <span className="text-xs text-[var(--color-text-muted)]">{tx.category}</span>
                      <span className="text-xs text-[var(--color-text-muted)]">·</span>
                      <span className="text-xs text-[var(--color-text-muted)]">{formatDate(tx.date)}</span>
                    </div>
                  </div>
                  <span
                    className="text-sm font-bold tabular-nums flex-shrink-0"
                    style={{ color: tx.type === "entrada" ? "var(--color-income)" : "var(--color-expense)" }}
                  >
                    {tx.type === "entrada" ? "+" : "-"}{formatCurrency(tx.amount)}
                  </span>
                  <button
                    onClick={() => setDeleteId(tx.id)}
                    aria-label="Excluir transação"
                    className="opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] transition-all duration-150"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* New transaction modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.type === "entrada" ? "Nova Entrada" : "Nova Saída"}
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4" noValidate>
          <div className="flex gap-2">
            {(["entrada", "saida"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: t, category: "" }))}
                className={`flex-1 h-9 text-sm font-medium rounded-[var(--radius-md)] transition-colors duration-150 border ${
                  form.type === t
                    ? t === "entrada"
                      ? "bg-[var(--color-success-subtle)] border-[var(--color-success)]/40 text-[var(--color-success)]"
                      : "bg-[var(--color-danger-subtle)] border-[var(--color-danger)]/40 text-[var(--color-danger)]"
                    : "bg-transparent border-[var(--color-border)] text-[var(--color-text-muted)]"
                }`}
              >
                {t === "entrada" ? "Entrada" : "Saída"}
              </button>
            ))}
          </div>

          <Select
            label="Categoria"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            options={[{ value: "", label: "Selecione..." }, ...categories.map((c) => ({ value: c, label: c }))]}
          />

          <Input
            label="Descrição"
            required
            placeholder="Ex: Venda de produto X"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Valor"
              required
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0,00"
              prefix="R$"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
            <Input
              label="Data"
              required
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>

          {formError && (
            <p role="alert" className="text-sm text-[var(--color-danger)]">{formError}</p>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving} className="flex-1">
              Salvar
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Excluir transação"
        size="sm"
      >
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setDeleteId(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            loading={deleting}
            onClick={() => deleteId && handleDelete(deleteId)}
          >
            Excluir
          </Button>
        </div>
      </Modal>
    </>
  );
}
