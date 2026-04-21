"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { useMobileMenu } from "@/lib/mobile-menu-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Product, StockMovement } from "@/types";
import {
  Plus,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  Pencil,
  Trash2,
  History,
  AlertTriangle,
  Search,
} from "lucide-react";

const UNIT_OPTIONS = [
  { value: "un", label: "Unidade (un)" },
  { value: "kg", label: "Quilograma (kg)" },
  { value: "g", label: "Grama (g)" },
  { value: "l", label: "Litro (l)" },
  { value: "ml", label: "Mililitro (ml)" },
  { value: "m", label: "Metro (m)" },
  { value: "cx", label: "Caixa (cx)" },
  { value: "pc", label: "Peça (pc)" },
];

const MOVEMENT_REASON_IN = ["Compra", "Devolução de cliente", "Ajuste de estoque", "Outros"];
const MOVEMENT_REASON_OUT = ["Venda", "Devolução a fornecedor", "Perda/Avaria", "Ajuste de estoque", "Outros"];

type ModalType = "product" | "movement" | "history" | "delete" | null;

export default function EstoquePage() {
  const openMenu = useMobileMenu();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalType>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);

  // Product form
  const [productForm, setProductForm] = useState({
    name: "",
    sku: "",
    unit: "un",
    cost_price: "",
    sale_price: "",
    stock_quantity: "",
  });

  // Movement form
  const [movementForm, setMovementForm] = useState({
    type: "entrada" as "entrada" | "saida",
    quantity: "",
    unit_cost: "",
    reason: "",
    date: new Date().toISOString().slice(0, 10),
  });

  const [formError, setFormError] = useState<string | null>(null);

  async function loadProducts() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name");
    if (!error) setProducts(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  function openProductModal(product?: Product) {
    if (product) {
      setSelectedProduct(product);
      setProductForm({
        name: product.name,
        sku: product.sku || "",
        unit: product.unit,
        cost_price: product.cost_price.toString(),
        sale_price: product.sale_price.toString(),
        stock_quantity: product.stock_quantity.toString(),
      });
    } else {
      setSelectedProduct(null);
      setProductForm({ name: "", sku: "", unit: "un", cost_price: "", sale_price: "", stock_quantity: "0" });
    }
    setFormError(null);
    setModal("product");
  }

  function openMovementModal(product: Product) {
    setSelectedProduct(product);
    setMovementForm({
      type: "entrada",
      quantity: "",
      unit_cost: product.cost_price.toString(),
      reason: "",
      date: new Date().toISOString().slice(0, 10),
    });
    setFormError(null);
    setModal("movement");
  }

  async function openHistoryModal(product: Product) {
    setSelectedProduct(product);
    setModal("history");
    const supabase = createClient();
    const { data } = await supabase
      .from("stock_movements")
      .select("*")
      .eq("product_id", product.id)
      .order("date", { ascending: false })
      .limit(30);
    setMovements(data || []);
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!productForm.name.trim()) {
      setFormError("Nome do produto é obrigatório.");
      return;
    }
    const cost = parseFloat(productForm.cost_price || "0");
    const sale = parseFloat(productForm.sale_price || "0");
    const qty = parseInt(productForm.stock_quantity || "0");

    setSaving(true);
    setFormError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const payload = {
      name: productForm.name.trim(),
      sku: productForm.sku.trim() || null,
      unit: productForm.unit,
      cost_price: cost,
      sale_price: sale,
      stock_quantity: qty,
      company_id: user?.id,
    };

    let error;
    if (selectedProduct) {
      ({ error } = await supabase.from("products").update(payload).eq("id", selectedProduct.id));
    } else {
      ({ error } = await supabase.from("products").insert(payload));
    }

    setSaving(false);
    if (error) { setFormError("Erro ao salvar produto."); return; }

    setModal(null);
    toast("success", selectedProduct ? "Produto atualizado!" : "Produto cadastrado!");
    loadProducts();
  }

  async function handleSaveMovement(e: React.FormEvent) {
    e.preventDefault();
    if (!movementForm.quantity || !selectedProduct) {
      setFormError("Quantidade é obrigatória.");
      return;
    }
    const qty = parseFloat(movementForm.quantity);
    if (isNaN(qty) || qty <= 0) { setFormError("Quantidade deve ser maior que zero."); return; }
    if (movementForm.type === "saida" && qty > selectedProduct.stock_quantity) {
      setFormError(`Estoque insuficiente. Disponível: ${selectedProduct.stock_quantity}`);
      return;
    }

    setSaving(true);
    setFormError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error: moveError } = await supabase.from("stock_movements").insert({
      product_id: selectedProduct.id,
      company_id: user?.id,
      type: movementForm.type,
      quantity: qty,
      unit_cost: movementForm.unit_cost ? parseFloat(movementForm.unit_cost) : null,
      reason: movementForm.reason || null,
      date: movementForm.date,
    });

    if (moveError) { setSaving(false); setFormError("Erro ao registrar movimentação."); return; }

    const newQty = movementForm.type === "entrada"
      ? selectedProduct.stock_quantity + qty
      : selectedProduct.stock_quantity - qty;

    const { error: updateError } = await supabase
      .from("products")
      .update({ stock_quantity: newQty })
      .eq("id", selectedProduct.id);

    setSaving(false);
    if (updateError) { setFormError("Erro ao atualizar estoque."); return; }

    setModal(null);
    toast("success", "Movimentação registrada!");
    loadProducts();
  }

  async function handleDeleteProduct() {
    if (!selectedProduct) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("stock_movements").delete().eq("product_id", selectedProduct.id);
    const { error } = await supabase.from("products").delete().eq("id", selectedProduct.id);
    setSaving(false);
    if (error) { toast("error", "Erro ao excluir produto."); return; }
    setModal(null);
    toast("success", "Produto excluído.");
    loadProducts();
  }

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku || "").toLowerCase().includes(search.toLowerCase())
  );

  const lowStockProducts = products.filter((p) => p.stock_quantity <= 5);

  return (
    <>
      <Header
        title="Estoque"
        subtitle={`${products.length} produto${products.length !== 1 ? "s" : ""} cadastrado${products.length !== 1 ? "s" : ""}`}
        onMenuClick={openMenu}
      >
        <Button size="sm" onClick={() => openProductModal()}>
          <Plus size={14} /> Novo produto
        </Button>
      </Header>

      <div className="p-4 md:p-6 flex flex-col gap-5 max-w-7xl mx-auto w-full">
        {/* Low stock alert */}
        {lowStockProducts.length > 0 && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-[var(--radius-lg)] bg-[var(--color-warning-subtle)] border border-[var(--color-warning)]/30">
            <AlertTriangle size={18} className="text-[var(--color-warning)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                Estoque baixo em {lowStockProducts.length} produto{lowStockProducts.length !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                {lowStockProducts.map((p) => p.name).join(", ")}
              </p>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative flex items-center">
          <Search size={15} className="absolute left-3 text-[var(--color-text-muted)] pointer-events-none" />
          <input
            type="search"
            placeholder="Buscar por nome ou SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
          />
        </div>

        {/* Products table */}
        <Card>
          {loading ? (
            <div className="py-16 flex items-center justify-center">
              <div className="text-sm text-[var(--color-text-muted)]">Carregando...</div>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Nenhum produto"
              description="Cadastre produtos para controlar seu estoque."
              action={
                <Button size="sm" onClick={() => openProductModal()}>
                  <Plus size={14} /> Cadastrar produto
                </Button>
              }
            />
          ) : (
            <>
              {/* Table header */}
              <div className="hidden md:grid grid-cols-[1fr_80px_120px_120px_100px_140px] gap-3 px-5 py-2.5 border-b border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                <span>Produto</span>
                <span className="text-right">Estoque</span>
                <span className="text-right">Custo</span>
                <span className="text-right">Preço</span>
                <span className="text-right">Margem</span>
                <span className="text-right">Ações</span>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {filtered.map((product) => {
                  const margin = product.cost_price > 0
                    ? ((product.sale_price - product.cost_price) / product.cost_price) * 100
                    : 0;
                  const isLow = product.stock_quantity <= 5;
                  return (
                    <div
                      key={product.id}
                      className="flex flex-col md:grid md:grid-cols-[1fr_80px_120px_120px_100px_140px] gap-2 md:gap-3 px-5 py-4 hover:bg-[var(--color-surface-elevated)] transition-colors duration-100"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{product.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {product.sku && (
                            <span className="text-xs text-[var(--color-text-muted)]">SKU: {product.sku}</span>
                          )}
                          <span className="text-xs text-[var(--color-text-muted)]">{product.unit}</span>
                        </div>
                      </div>
                      <div className="flex md:justify-end items-center gap-2 md:gap-0">
                        <span className="md:hidden text-xs text-[var(--color-text-muted)]">Estoque:</span>
                        <span className={`text-sm font-bold tabular-nums ${isLow ? "text-[var(--color-warning)]" : "text-[var(--color-text-primary)]"}`}>
                          {product.stock_quantity}
                          {isLow && <AlertTriangle size={12} className="inline ml-1" />}
                        </span>
                      </div>
                      <div className="flex md:justify-end items-center gap-2">
                        <span className="md:hidden text-xs text-[var(--color-text-muted)]">Custo:</span>
                        <span className="text-sm tabular-nums text-[var(--color-text-secondary)]">
                          {formatCurrency(product.cost_price)}
                        </span>
                      </div>
                      <div className="flex md:justify-end items-center gap-2">
                        <span className="md:hidden text-xs text-[var(--color-text-muted)]">Preço:</span>
                        <span className="text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">
                          {formatCurrency(product.sale_price)}
                        </span>
                      </div>
                      <div className="flex md:justify-end items-center gap-2">
                        <span className="md:hidden text-xs text-[var(--color-text-muted)]">Margem:</span>
                        <Badge variant={margin >= 30 ? "success" : margin >= 10 ? "warning" : "danger"}>
                          {margin.toFixed(1)}%
                        </Badge>
                      </div>
                      <div className="flex md:justify-end items-center gap-1.5">
                        <button
                          onClick={() => openMovementModal(product)}
                          title="Movimentar estoque"
                          className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] transition-all duration-150"
                        >
                          <ArrowUpRight size={15} />
                        </button>
                        <button
                          onClick={() => openHistoryModal(product)}
                          title="Histórico"
                          className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] transition-all duration-150"
                        >
                          <History size={15} />
                        </button>
                        <button
                          onClick={() => openProductModal(product)}
                          title="Editar"
                          className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] transition-all duration-150"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => { setSelectedProduct(product); setModal("delete"); }}
                          title="Excluir"
                          className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] transition-all duration-150"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Product modal */}
      <Modal
        open={modal === "product"}
        onClose={() => setModal(null)}
        title={selectedProduct ? "Editar produto" : "Novo produto"}
        size="lg"
      >
        <form onSubmit={handleSaveProduct} className="flex flex-col gap-4" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nome do produto"
              required
              placeholder="Ex: Camiseta básica"
              value={productForm.name}
              onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              label="SKU / Código"
              placeholder="Ex: CAM-001"
              value={productForm.sku}
              onChange={(e) => setProductForm((f) => ({ ...f, sku: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Unidade"
              value={productForm.unit}
              onChange={(e) => setProductForm((f) => ({ ...f, unit: e.target.value }))}
              options={UNIT_OPTIONS}
            />
            <Input
              label="Custo unitário"
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              prefix="R$"
              value={productForm.cost_price}
              onChange={(e) => setProductForm((f) => ({ ...f, cost_price: e.target.value }))}
            />
            <Input
              label="Preço de venda"
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              prefix="R$"
              value={productForm.sale_price}
              onChange={(e) => setProductForm((f) => ({ ...f, sale_price: e.target.value }))}
            />
          </div>
          {!selectedProduct && (
            <Input
              label="Estoque inicial"
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={productForm.stock_quantity}
              onChange={(e) => setProductForm((f) => ({ ...f, stock_quantity: e.target.value }))}
              helper="Quantidade disponível ao cadastrar o produto"
            />
          )}

          {productForm.cost_price && productForm.sale_price && (
            <div className="px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface-elevated)] border border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-text-muted)] mb-1">Margem calculada</p>
              <p className="text-lg font-bold tabular-nums" style={{
                color: (() => {
                  const m = parseFloat(productForm.sale_price) > 0 && parseFloat(productForm.cost_price) > 0
                    ? ((parseFloat(productForm.sale_price) - parseFloat(productForm.cost_price)) / parseFloat(productForm.cost_price)) * 100
                    : 0;
                  return m >= 30 ? "var(--color-success)" : m >= 10 ? "var(--color-warning)" : "var(--color-danger)";
                })()
              }}>
                {parseFloat(productForm.cost_price) > 0
                  ? `${(((parseFloat(productForm.sale_price) || 0) - parseFloat(productForm.cost_price)) / parseFloat(productForm.cost_price) * 100).toFixed(1)}%`
                  : "—"}
              </p>
            </div>
          )}

          {formError && <p role="alert" className="text-sm text-[var(--color-danger)]">{formError}</p>}
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1">Salvar</Button>
          </div>
        </form>
      </Modal>

      {/* Movement modal */}
      <Modal
        open={modal === "movement"}
        onClose={() => setModal(null)}
        title={`Movimentar: ${selectedProduct?.name}`}
      >
        <form onSubmit={handleSaveMovement} className="flex flex-col gap-4" noValidate>
          <div className="flex gap-2">
            {(["entrada", "saida"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setMovementForm((f) => ({ ...f, type: t, reason: "" }))}
                className={`flex-1 h-9 flex items-center justify-center gap-2 text-sm font-medium rounded-[var(--radius-md)] transition-colors duration-150 border ${
                  movementForm.type === t
                    ? t === "entrada"
                      ? "bg-[var(--color-success-subtle)] border-[var(--color-success)]/40 text-[var(--color-success)]"
                      : "bg-[var(--color-danger-subtle)] border-[var(--color-danger)]/40 text-[var(--color-danger)]"
                    : "bg-transparent border-[var(--color-border)] text-[var(--color-text-muted)]"
                }`}
              >
                {t === "entrada" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {t === "entrada" ? "Entrada" : "Saída"}
              </button>
            ))}
          </div>

          <div className="px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface-elevated)] text-sm">
            <span className="text-[var(--color-text-muted)]">Estoque atual: </span>
            <span className="font-bold text-[var(--color-text-primary)] tabular-nums">
              {selectedProduct?.stock_quantity} {selectedProduct?.unit}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Quantidade"
              required
              type="number"
              min="0.001"
              step="any"
              placeholder="0"
              value={movementForm.quantity}
              onChange={(e) => setMovementForm((f) => ({ ...f, quantity: e.target.value }))}
            />
            {movementForm.type === "entrada" && (
              <Input
                label="Custo unitário"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                prefix="R$"
                value={movementForm.unit_cost}
                onChange={(e) => setMovementForm((f) => ({ ...f, unit_cost: e.target.value }))}
              />
            )}
          </div>

          <Select
            label="Motivo"
            value={movementForm.reason}
            onChange={(e) => setMovementForm((f) => ({ ...f, reason: e.target.value }))}
            options={[
              { value: "", label: "Selecione..." },
              ...(movementForm.type === "entrada" ? MOVEMENT_REASON_IN : MOVEMENT_REASON_OUT).map((r) => ({ value: r, label: r })),
            ]}
          />

          <Input
            label="Data"
            type="date"
            required
            value={movementForm.date}
            onChange={(e) => setMovementForm((f) => ({ ...f, date: e.target.value }))}
          />

          {formError && <p role="alert" className="text-sm text-[var(--color-danger)]">{formError}</p>}
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1">Registrar</Button>
          </div>
        </form>
      </Modal>

      {/* History modal */}
      <Modal
        open={modal === "history"}
        onClose={() => setModal(null)}
        title={`Histórico: ${selectedProduct?.name}`}
        size="lg"
      >
        <div className="max-h-96 overflow-y-auto -mx-6 px-6">
          {movements.length === 0 ? (
            <p className="text-sm text-center text-[var(--color-text-muted)] py-8">
              Nenhuma movimentação registrada.
            </p>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {movements.map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-3">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: m.type === "entrada" ? "var(--color-success-subtle)" : "var(--color-danger-subtle)" }}
                  >
                    {m.type === "entrada"
                      ? <ArrowUpRight size={14} className="text-[var(--color-income)]" />
                      : <ArrowDownRight size={14} className="text-[var(--color-expense)]" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {m.type === "entrada" ? "+" : "-"}{m.quantity} {selectedProduct?.unit}
                      {m.reason && <span className="text-[var(--color-text-muted)] font-normal"> · {m.reason}</span>}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">{formatDate(m.date)}</p>
                  </div>
                  {m.unit_cost && (
                    <span className="text-sm tabular-nums text-[var(--color-text-secondary)]">
                      {formatCurrency(m.unit_cost)}/un
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Delete modal */}
      <Modal open={modal === "delete"} onClose={() => setModal(null)} title="Excluir produto" size="sm">
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          Excluir <strong>{selectedProduct?.name}</strong>? Todo o histórico de movimentações também será excluído.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" loading={saving} onClick={handleDeleteProduct}>Excluir</Button>
        </div>
      </Modal>
    </>
  );
}
