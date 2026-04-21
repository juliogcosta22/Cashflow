"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { useMobileMenu } from "@/lib/mobile-menu-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { CashTransaction, Product } from "@/types";

interface StatCard {
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
  icon: React.ElementType;
  color: string;
}

export default function DashboardPage() {
  const openMenu = useMobileMenu();
  const [loading, setLoading] = useState(true);
  const [income, setIncome] = useState(0);
  const [expense, setExpense] = useState(0);
  const [productCount, setProductCount] = useState(0);
  const [lowStock, setLowStock] = useState(0);
  const [chartData, setChartData] = useState<{ month: string; Entradas: number; Saídas: number }[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<CashTransaction[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Fetch cash transactions this month
      const { data: txs } = await supabase
        .from("cash_transactions")
        .select("*")
        .gte("date", firstDay)
        .order("date", { ascending: false });

      if (txs) {
        const inc = txs.filter((t: CashTransaction) => t.type === "entrada").reduce((s: number, t: CashTransaction) => s + t.amount, 0);
        const exp = txs.filter((t: CashTransaction) => t.type === "saida").reduce((s: number, t: CashTransaction) => s + t.amount, 0);
        setIncome(inc);
        setExpense(exp);
        setRecentTransactions(txs.slice(0, 6));
      }

      // Fetch all-time by month for chart (last 6 months)
      const months: { month: string; Entradas: number; Saídas: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = d.toISOString().slice(0, 7) + "-01";
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
        const label = d.toLocaleDateString("pt-BR", { month: "short" });
        const { data: mt } = await supabase
          .from("cash_transactions")
          .select("type, amount")
          .gte("date", start)
          .lte("date", end);
        const mInc = (mt || []).filter((t: { type: string }) => t.type === "entrada").reduce((s: number, t: { amount: number }) => s + t.amount, 0);
        const mExp = (mt || []).filter((t: { type: string }) => t.type === "saida").reduce((s: number, t: { amount: number }) => s + t.amount, 0);
        months.push({ month: label, Entradas: mInc, Saídas: mExp });
      }
      setChartData(months);

      // Products
      const { data: products, count } = await supabase
        .from("products")
        .select("*", { count: "exact" });
      setProductCount(count || 0);
      if (products) {
        setLowStock(products.filter((p: Product) => p.stock_quantity <= 5).length);
      }

      setLoading(false);
    }
    load();
  }, []);

  const balance = income - expense;

  const stats: StatCard[] = [
    {
      label: "Entradas (mês)",
      value: formatCurrency(income),
      icon: TrendingUp,
      color: "var(--color-income)",
      positive: true,
    },
    {
      label: "Saídas (mês)",
      value: formatCurrency(expense),
      icon: TrendingDown,
      color: "var(--color-expense)",
      positive: false,
    },
    {
      label: "Saldo do mês",
      value: formatCurrency(balance),
      icon: DollarSign,
      color: balance >= 0 ? "var(--color-income)" : "var(--color-expense)",
      positive: balance >= 0,
    },
    {
      label: "Produtos",
      value: productCount.toString(),
      icon: Package,
      color: "var(--color-primary)",
    },
  ];

  return (
    <>
      <Header
        title="Dashboard"
        subtitle={new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        onMenuClick={openMenu}
      />

      <div className="p-4 md:p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label}>
                <CardContent className="py-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--color-text-muted)] font-medium mb-1 truncate">
                        {stat.label}
                      </p>
                      <p
                        className="text-xl font-bold tabular-nums leading-tight truncate"
                        style={{ color: stat.color }}
                      >
                        {loading ? "—" : stat.value}
                      </p>
                    </div>
                    <div
                      className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${stat.color}18` }}
                    >
                      <Icon size={18} style={{ color: stat.color }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Low stock alert */}
        {lowStock > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)] bg-[var(--color-warning-subtle)] border border-[var(--color-warning)]/30">
            <AlertTriangle size={18} className="text-[var(--color-warning)] flex-shrink-0" />
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {lowStock} produto{lowStock !== 1 ? "s" : ""} com estoque baixo (≤ 5 unidades)
            </p>
          </div>
        )}

        {/* Chart + Recent */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Area chart */}
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Fluxo dos últimos 6 meses</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              {loading ? (
                <div className="h-56 flex items-center justify-center">
                  <div className="text-sm text-[var(--color-text-muted)]">Carregando...</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                    <defs>
                      <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#dc2626" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "8px",
                        fontSize: 12,
                        color: "var(--color-text-primary)",
                      }}
                      formatter={(v) => formatCurrency(Number(v))}
                    />
                    <Area type="monotone" dataKey="Entradas" stroke="#059669" fill="url(#gIncome)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="Saídas" stroke="#dc2626" fill="url(#gExpense)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Recent transactions */}
          <Card>
            <CardHeader>
              <CardTitle>Últimas transações</CardTitle>
            </CardHeader>
            <div className="divide-y divide-[var(--color-border)]">
              {loading ? (
                <div className="px-6 py-8 text-center text-sm text-[var(--color-text-muted)]">
                  Carregando...
                </div>
              ) : recentTransactions.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-[var(--color-text-muted)]">
                  Nenhuma transação este mês
                </div>
              ) : (
                recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between px-6 py-3 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
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
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                          {tx.description}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">{tx.category}</p>
                      </div>
                    </div>
                    <span
                      className="text-sm font-semibold tabular-nums flex-shrink-0"
                      style={{ color: tx.type === "entrada" ? "var(--color-income)" : "var(--color-expense)" }}
                    >
                      {tx.type === "entrada" ? "+" : "-"}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
