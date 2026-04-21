"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { useMobileMenu } from "@/lib/mobile-menu-context";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import type { Product, CartItem, PaymentMethod } from "@/types";
import {
  Search, Plus, Minus, Trash2, ShoppingCart, Check,
  Banknote, CreditCard, Smartphone, Wallet, X, Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const PAYMENT_METHODS: { key: PaymentMethod; label: string; icon: React.ElementType; color: string }[] = [
  { key: "dinheiro", label: "Dinheiro", icon: Banknote, color: "#059669" },
  { key: "pix",      label: "PIX",      icon: Smartphone, color: "#7c3aed" },
  { key: "debito",   label: "Débito",   icon: CreditCard, color: "#2563eb" },
  { key: "credito",  label: "Crédito",  icon: Wallet,     color: "#d97706" },
];

type Screen = "pos" | "payment" | "success";

export default function PDVPage() {
  const openMenu = useMobileMenu();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [screen, setScreen] = useState<Screen>("pos");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [discount, setDiscount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSale, setLastSale] = useState<{ total: number; method: string } | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("products")
        .select("*")
        .gt("sale_price", 0)
        .order("name");
      setProducts(data || []);
    }
    load();
  }, []);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku || "").toLowerCase().includes(search.toLowerCase())
  );

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i)
        .filter((i) => i.quantity > 0)
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  }

  function clearCart() {
    setCart([]);
    setDiscount("");
    setNote("");
    setPaymentMethod(null);
    setScreen("pos");
  }

  const subtotal = cart.reduce((s, i) => s + i.product.sale_price * i.quantity, 0);
  const discountValue = Math.min(parseFloat(discount || "0"), subtotal);
  const total = Math.max(subtotal - discountValue, 0);
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);

  async function confirmSale() {
    if (!paymentMethod || cart.length === 0) return;
    setSaving(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: sale, error } = await supabase
      .from("sales")
      .insert({
        company_id: user?.id,
        payment_method: paymentMethod,
        total,
        discount: discountValue,
        note: note || null,
        date: new Date().toISOString().slice(0, 10),
      })
      .select()
      .single();

    if (error || !sale) {
      toast("error", "Erro ao registrar venda.");
      setSaving(false);
      return;
    }

    await supabase.from("sale_items").insert(
      cart.map((i) => ({
        sale_id: sale.id,
        product_id: i.product.id,
        product_name: i.product.name,
        quantity: i.quantity,
        unit_price: i.product.sale_price,
        total: i.product.sale_price * i.quantity,
      }))
    );

    // Deduct stock for each product
    for (const item of cart) {
      await supabase
        .from("products")
        .update({ stock_quantity: Math.max(item.product.stock_quantity - item.quantity, 0) })
        .eq("id", item.product.id);
    }

    // Also record as cash entrada
    await supabase.from("cash_transactions").insert({
      company_id: user?.id,
      type: "entrada",
      category: "Venda de produtos",
      description: `Venda PDV — ${PAYMENT_METHODS.find(m => m.key === paymentMethod)?.label}`,
      amount: total,
      date: new Date().toISOString().slice(0, 10),
    });

    setLastSale({ total, method: PAYMENT_METHODS.find(m => m.key === paymentMethod)?.label || "" });
    setSaving(false);
    setScreen("success");
  }

  // ── Success screen ─────────────────────────────────────────
  if (screen === "success" && lastSale) {
    return (
      <div className="flex-1 flex flex-col">
        <Header title="PDV" onMenuClick={openMenu} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="flex flex-col items-center text-center max-w-sm">
            <div className="w-20 h-20 rounded-full bg-[var(--color-success-subtle)] flex items-center justify-center mb-6">
              <Check size={40} className="text-[var(--color-success)]" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">Venda concluída!</h2>
            <p className="text-[var(--color-text-muted)] mb-2">Pagamento via {lastSale.method}</p>
            <p className="text-4xl font-bold tabular-nums text-[var(--color-success)] mb-8">
              {formatCurrency(lastSale.total)}
            </p>
            <Button size="lg" onClick={clearCart} className="w-full">
              Nova venda
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Payment screen ─────────────────────────────────────────
  if (screen === "payment") {
    return (
      <div className="flex-1 flex flex-col">
        <Header title="Forma de Pagamento" onMenuClick={openMenu} />
        <div className="flex-1 flex flex-col p-4 md:p-6 max-w-lg mx-auto w-full gap-5">

          {/* Total */}
          <div className="text-center py-6">
            <p className="text-sm text-[var(--color-text-muted)] mb-1">Total a receber</p>
            <p className="text-5xl font-bold tabular-nums text-[var(--color-text-primary)]">
              {formatCurrency(total)}
            </p>
            {discountValue > 0 && (
              <p className="text-sm text-[var(--color-success)] mt-1">
                Desconto: -{formatCurrency(discountValue)}
              </p>
            )}
          </div>

          {/* Payment methods */}
          <div className="grid grid-cols-2 gap-3">
            {PAYMENT_METHODS.map(({ key, label, icon: Icon, color }) => (
              <button
                key={key}
                onClick={() => setPaymentMethod(key)}
                className={`flex flex-col items-center justify-center gap-3 h-28 rounded-[var(--radius-xl)] border-2 transition-all duration-150 ${
                  paymentMethod === key
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)] shadow-[var(--shadow-elevated)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/50"
                }`}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: `${color}18` }}
                >
                  <Icon size={24} style={{ color }} />
                </div>
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">{label}</span>
              </button>
            ))}
          </div>

          {/* Optional discount + note */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Tag size={15} className="text-[var(--color-text-muted)]" />
              <span className="text-sm font-medium text-[var(--color-text-secondary)]">Desconto</span>
              <div className="relative flex items-center ml-auto">
                <span className="absolute left-3 text-sm text-[var(--color-text-muted)] pointer-events-none">R$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-32 h-9 pl-9 pr-3 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>
            </div>
            <input
              type="text"
              placeholder="Observação (opcional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full h-10 px-3 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-auto">
            <Button variant="secondary" onClick={() => setScreen("pos")} className="flex-1">
              Voltar
            </Button>
            <Button
              onClick={confirmSale}
              disabled={!paymentMethod}
              loading={saving}
              className="flex-1"
              size="lg"
            >
              <Check size={18} />
              Confirmar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── POS screen ─────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="PDV" subtitle="Ponto de Venda" onMenuClick={openMenu} />

      <div className="flex-1 flex overflow-hidden">
        {/* Left: product grid */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search */}
          <div className="px-4 py-3 border-b border-[var(--color-border)]">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
              <input
                type="search"
                placeholder="Buscar produto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                className="w-full h-10 pl-9 pr-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
            </div>
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-muted)]">
                {products.length === 0 ? "Nenhum produto cadastrado" : "Nenhum produto encontrado"}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {filtered.map((product) => {
                  const inCart = cart.find((i) => i.product.id === product.id);
                  const outOfStock = product.stock_quantity <= 0;
                  return (
                    <button
                      key={product.id}
                      onClick={() => !outOfStock && addToCart(product)}
                      disabled={outOfStock}
                      aria-label={`Adicionar ${product.name}`}
                      className={`relative flex flex-col items-start justify-between p-3 rounded-[var(--radius-lg)] border-2 text-left min-h-[90px] transition-all duration-100 select-none ${
                        outOfStock
                          ? "border-[var(--color-border)] bg-[var(--color-surface-elevated)] opacity-50 cursor-not-allowed"
                          : inCart
                          ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)] shadow-sm active:scale-95"
                          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/60 hover:shadow-sm active:scale-95"
                      }`}
                    >
                      {inCart && (
                        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-bold flex items-center justify-center">
                          {inCart.quantity}
                        </span>
                      )}
                      <span className="text-sm font-semibold text-[var(--color-text-primary)] leading-tight pr-6 line-clamp-2">
                        {product.name}
                      </span>
                      <div className="mt-2 flex flex-col gap-0.5">
                        <span className="text-base font-bold tabular-nums text-[var(--color-primary)]">
                          {formatCurrency(product.sale_price)}
                        </span>
                        {outOfStock && (
                          <span className="text-[10px] text-[var(--color-danger)] font-medium">Sem estoque</span>
                        )}
                        {!outOfStock && (
                          <span className="text-[10px] text-[var(--color-text-muted)]">
                            Estoque: {product.stock_quantity}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Cart */}
        <div className="w-72 xl:w-80 flex-shrink-0 border-l border-[var(--color-border)] flex flex-col bg-[var(--color-surface)]">
          {/* Cart header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <ShoppingCart size={16} className="text-[var(--color-text-secondary)]" />
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                Carrinho
                {itemCount > 0 && (
                  <span className="ml-1.5 text-xs font-bold text-[var(--color-primary)]">
                    ({itemCount})
                  </span>
                )}
              </span>
            </div>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                aria-label="Limpar carrinho"
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
                <ShoppingCart size={28} className="text-[var(--color-text-muted)]" />
                <p className="text-sm text-[var(--color-text-muted)]">
                  Clique nos produtos para adicionar
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {cart.map(({ product, quantity }) => (
                  <div key={product.id} className="px-4 py-3 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-[var(--color-text-primary)] leading-tight flex-1">
                        {product.name}
                      </span>
                      <button
                        onClick={() => removeFromCart(product.id)}
                        aria-label="Remover"
                        className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors flex-shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQty(product.id, -1)}
                          aria-label="Diminuir"
                          className="w-7 h-7 rounded-full border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-8 text-center text-sm font-bold tabular-nums text-[var(--color-text-primary)]">
                          {quantity}
                        </span>
                        <button
                          onClick={() => updateQty(product.id, 1)}
                          aria-label="Aumentar"
                          className="w-7 h-7 rounded-full border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-[var(--color-text-primary)]">
                        {formatCurrency(product.sale_price * quantity)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart footer */}
          <div className="border-t border-[var(--color-border)] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-muted)]">Subtotal</span>
              <span className="text-lg font-bold tabular-nums text-[var(--color-text-primary)]">
                {formatCurrency(subtotal)}
              </span>
            </div>
            <Button
              size="lg"
              className="w-full"
              disabled={cart.length === 0}
              onClick={() => setScreen("payment")}
            >
              Ir para pagamento
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
