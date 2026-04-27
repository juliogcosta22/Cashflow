"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { useMobileMenu } from "@/lib/mobile-menu-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, localToday } from "@/lib/utils";
import type { Product, StockMovement, ProductComponent, ProductType } from "@/types";
import {
  Plus, Package, ArrowUpRight, ArrowDownRight, Pencil,
  Trash2, History, AlertTriangle, Search, Layers, X, ShoppingCart,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────

const UNIT_OPTIONS = [
  { value: "un",  label: "Unidade (un)" },
  { value: "ml",  label: "Mililitro (ml)" },
  { value: "L",   label: "Litro (L)" },
  { value: "g",   label: "Grama (g)" },
  { value: "kg",  label: "Quilograma (kg)" },
  { value: "m",   label: "Metro (m)" },
  { value: "cx",  label: "Caixa (cx)" },
  { value: "pc",  label: "Peça (pc)" },
];

const CONTINUOUS_UNITS = new Set(["ml", "L", "g", "kg", "m"]);

const MOVEMENT_REASON_IN  = ["Compra", "Devolução de cliente", "Ajuste de estoque", "Outros"];
const MOVEMENT_REASON_OUT = ["Venda", "Devolução a fornecedor", "Perda/Avaria", "Ajuste de estoque", "Outros"];

type ModalType = "product" | "movement" | "history" | "delete" | null;
type FilterKind = "all" | "produto" | "insumo";

interface ComponentRow {
  product_id: string;
  product_name: string;
  product_type: ProductType;
  quantity: string;
  unit: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatStock(qty: number, unit: string): string {
  if (!CONTINUOUS_UNITS.has(unit)) return String(Math.round(qty));
  const n = parseFloat(qty.toFixed(3));
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${unit}`;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function EstoquePage() {
  const openMenu = useMobileMenu();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterKind, setFilterKind] = useState<FilterKind>("all");
  const [modal, setModal] = useState<ModalType>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);

  // Derived stock: productId → available units (from component stock)
  const [derivedStock, setDerivedStock] = useState<Record<string, number>>({});

  // Product form
  const [productForm, setProductForm] = useState({
    name: "",
    sku: "",
    unit: "un",
    product_type: "produto" as ProductType,
    cost_price: "",
    sale_price: "",
    stock_quantity: "",
  });

  // Composition
  const [isComposed, setIsComposed] = useState(false);
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [compSearch, setCompSearch] = useState("");
  const [existingComponents, setExistingComponents] = useState<(ProductComponent & { component: Product })[]>([]);

  // Movement form
  const [movementForm, setMovementForm] = useState({
    type: "entrada" as "entrada" | "saida",
    quantity: "",
    unit_cost: "",
    reason: "",
    date: localToday(),
  });

  const [formError, setFormError] = useState<string | null>(null);

  // ── Data loading ────────────────────────────────────────────────────────────

  async function loadProducts() {
    const supabase = createClient();
    const { data, error } = await supabase.from("products").select("*").order("name");
    if (!error) {
      const prods = data || [];
      setProducts(prods);

      if (prods.length > 0) {
        // Load all component data to compute derived stock for composed products
        const { data: comps } = await supabase
          .from("product_components")
          .select("parent_product_id, quantity, component:component_product_id(id, stock_quantity)")
          .in("parent_product_id", prods.map((p: Product) => p.id));

        const byParent: Record<string, { quantity: number; stock: number }[]> = {};
        (comps || []).forEach((c: any) => {
          if (!byParent[c.parent_product_id]) byParent[c.parent_product_id] = [];
          if (c.component) byParent[c.parent_product_id].push({ quantity: c.quantity, stock: c.component.stock_quantity });
        });

        const derived: Record<string, number> = {};
        for (const [id, cs] of Object.entries(byParent)) {
          if (cs.length > 0) {
            derived[id] = Math.floor(Math.min(...cs.map(c => c.stock / c.quantity)));
          }
        }
        setDerivedStock(derived);
      }
    }
    setLoading(false);
  }

  useEffect(() => { loadProducts(); }, []);

  // ── Computed cost from components ───────────────────────────────────────────

  const computedCost = components.reduce((sum, c) => {
    const prod = products.find(p => p.id === c.product_id);
    if (!prod) return sum;
    return sum + prod.cost_price * (parseFloat(c.quantity) || 0);
  }, 0);

  async function loadExistingComponents(productId: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("product_components")
      .select("*, component:component_product_id(id,name,unit,product_type,cost_price,sale_price,stock_quantity)")
      .eq("parent_product_id", productId);
    setExistingComponents((data as any) || []);
  }

  // ── Product modal ───────────────────────────────────────────────────────────

  function openProductModal(product?: Product) {
    setFormError(null);
    setComponents([]);
    setIsComposed(false);
    setExistingComponents([]);
    setCompSearch("");

    if (product) {
      setSelectedProduct(product);
      setProductForm({
        name: product.name,
        sku: product.sku || "",
        unit: product.unit,
        product_type: product.product_type || "produto",
        cost_price: product.cost_price.toString(),
        sale_price: product.sale_price.toString(),
        stock_quantity: product.stock_quantity.toString(),
      });
      loadExistingComponents(product.id);
    } else {
      setSelectedProduct(null);
      setProductForm({ name: "", sku: "", unit: "un", product_type: "produto", cost_price: "", sale_price: "", stock_quantity: "0" });
    }
    setModal("product");
  }

  function addComponent(product: Product) {
    if (components.find(c => c.product_id === product.id)) return;
    setComponents(prev => [...prev, {
      product_id: product.id,
      product_name: product.name,
      product_type: product.product_type,
      quantity: "1",
      unit: product.unit,
    }]);
    setCompSearch("");
  }

  function removeComponent(productId: string) {
    setComponents(prev => prev.filter(c => c.product_id !== productId));
  }

  async function removeExistingComponent(id: string) {
    const supabase = createClient();
    await supabase.from("product_components").delete().eq("id", id);
    if (selectedProduct) loadExistingComponents(selectedProduct.id);
  }

  const filteredForComp = products
    .filter(p =>
      p.id !== selectedProduct?.id &&
      !components.find(c => c.product_id === p.id) &&
      !existingComponents.find(c => c.component_product_id === p.id) &&
      p.name.toLowerCase().includes(compSearch.toLowerCase())
    )
    // Show insumos first
    .sort((a, b) => {
      if (a.product_type === "insumo" && b.product_type !== "insumo") return -1;
      if (a.product_type !== "insumo" && b.product_type === "insumo") return 1;
      return 0;
    })
    .slice(0, 6);

  // ── Movement modal ──────────────────────────────────────────────────────────

  function openMovementModal(product: Product) {
    setSelectedProduct(product);
    setMovementForm({
      type: "entrada",
      quantity: "",
      unit_cost: product.cost_price.toString(),
      reason: "",
      date: localToday(),
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

  // ── Save product ────────────────────────────────────────────────────────────

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!productForm.name.trim()) { setFormError("Nome do produto é obrigatório."); return; }

    const cost = isComposed && components.length > 0 ? computedCost : parseFloat(productForm.cost_price || "0");
    const sale = parseFloat(productForm.sale_price || "0");
    const qty  = parseFloat(productForm.stock_quantity || "0");

    setSaving(true);
    setFormError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const payload = {
      name: productForm.name.trim(),
      sku: productForm.sku.trim() || null,
      unit: productForm.unit,
      product_type: productForm.product_type,
      cost_price: cost,
      sale_price: productForm.product_type === "insumo" ? 0 : sale,
      stock_quantity: qty,
      company_id: user?.id,
    };

    let productId = selectedProduct?.id;
    let error;

    if (selectedProduct) {
      ({ error } = await supabase.from("products").update(payload).eq("id", selectedProduct.id));
    } else {
      const { data, error: insertError } = await supabase.from("products").insert(payload).select().single();
      error = insertError;
      productId = data?.id;
    }

    if (error) { setSaving(false); setFormError("Erro ao salvar produto."); return; }

    // Save new components
    if (isComposed && components.length > 0 && productId) {
      await supabase.from("product_components").insert(
        components.map(c => ({
          company_id: user?.id,
          parent_product_id: productId,
          component_product_id: c.product_id,
          quantity: parseFloat(c.quantity) || 1,
        }))
      );
    }

    setSaving(false);
    setModal(null);
    toast("success", selectedProduct ? "Produto atualizado!" : "Produto cadastrado!");
    loadProducts();
  }

  // ── Save movement ───────────────────────────────────────────────────────────

  async function handleSaveMovement(e: React.FormEvent) {
    e.preventDefault();
    if (!movementForm.quantity || !selectedProduct) { setFormError("Quantidade é obrigatória."); return; }
    const qty = parseFloat(movementForm.quantity);
    if (isNaN(qty) || qty <= 0) { setFormError("Quantidade deve ser maior que zero."); return; }
    if (movementForm.type === "saida" && qty > selectedProduct.stock_quantity) {
      setFormError(`Estoque insuficiente. Disponível: ${formatStock(selectedProduct.stock_quantity, selectedProduct.unit)}`);
      return;
    }

    setSaving(true);
    setFormError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from("stock_movements").insert({
      product_id: selectedProduct.id,
      company_id: user?.id,
      type: movementForm.type,
      quantity: qty,
      unit_cost: movementForm.unit_cost ? parseFloat(movementForm.unit_cost) : null,
      reason: movementForm.reason || null,
      date: movementForm.date,
    });

    const newQty = movementForm.type === "entrada"
      ? selectedProduct.stock_quantity + qty
      : selectedProduct.stock_quantity - qty;

    await supabase.from("products").update({ stock_quantity: newQty }).eq("id", selectedProduct.id);

    setSaving(false);
    setModal(null);
    toast("success", "Movimentação registrada!");
    loadProducts();
  }

  // ── Delete product ──────────────────────────────────────────────────────────

  async function handleDeleteProduct() {
    if (!selectedProduct) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("product_components").delete().eq("parent_product_id", selectedProduct.id);
    await supabase.from("stock_movements").delete().eq("product_id", selectedProduct.id);
    const { error } = await supabase.from("products").delete().eq("id", selectedProduct.id);
    setSaving(false);
    if (error) { toast("error", "Erro ao excluir produto."); return; }
    setModal(null);
    toast("success", "Produto excluído.");
    loadProducts();
  }

  // ── Filtered list ───────────────────────────────────────────────────────────

  const filtered = products.filter(p =>
    (filterKind === "all" || p.product_type === filterKind) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku || "").toLowerCase().includes(search.toLowerCase()))
  );

  const lowStockProducts = products.filter(p => {
    if (derivedStock[p.id] !== undefined) return derivedStock[p.id] <= 0;
    return p.stock_quantity <= 5;
  });

  useEffect(() => {
    if (isComposed && components.length > 0) {
      setProductForm(f => ({ ...f, cost_price: computedCost.toFixed(2) }));
    }
  }, [isComposed, components, computedCost]);

  const isInsumoForm = productForm.product_type === "insumo";
  const isContinuousUnit = CONTINUOUS_UNITS.has(productForm.unit);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <Header
        title="Estoque"
        subtitle={`${products.length} item${products.length !== 1 ? "s" : ""}`}
        onMenuClick={openMenu}
      >
        <Button size="sm" onClick={() => openProductModal()}>
          <Plus size={14} /> Novo item
        </Button>
      </Header>

      <div className="p-4 md:p-6 flex flex-col gap-5 max-w-7xl mx-auto w-full">

        {/* Low stock alert */}
        {lowStockProducts.length > 0 && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-[var(--radius-lg)] bg-[var(--color-warning-subtle)] border border-[var(--color-warning)]/30">
            <AlertTriangle size={18} className="text-[var(--color-warning)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                Estoque baixo em {lowStockProducts.length} item{lowStockProducts.length !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                {lowStockProducts.map(p => p.name).join(", ")}
              </p>
            </div>
          </div>
        )}

        {/* Search + filter */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
            <input
              type="search"
              placeholder="Buscar por nome ou SKU..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
            />
          </div>
          <div className="flex gap-1">
            {([
              { key: "all",     label: "Todos" },
              { key: "produto", label: "Produtos" },
              { key: "insumo",  label: "Insumos" },
            ] as { key: FilterKind; label: string }[]).map(({ key, label }) => (
              <button key={key} onClick={() => setFilterKind(key)}
                className={`px-3 h-9 text-sm font-medium rounded-[var(--radius-md)] transition-colors duration-150 ${
                  filterKind === key
                    ? "bg-[var(--color-primary)] text-white"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]"
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <Card>
          {loading ? (
            <div className="py-16 flex items-center justify-center">
              <div className="text-sm text-[var(--color-text-muted)]">Carregando...</div>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Nenhum item"
              description="Cadastre produtos e insumos para controlar seu estoque."
              action={<Button size="sm" onClick={() => openProductModal()}><Plus size={14} /> Cadastrar</Button>}
            />
          ) : (
            <>
              {/* Header row */}
              <div className="hidden md:grid grid-cols-[1fr_100px_120px_120px_100px_140px] gap-3 px-5 py-2.5 border-b border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                <span>Item</span>
                <span className="text-right">Estoque</span>
                <span className="text-right">Custo</span>
                <span className="text-right">Preço</span>
                <span className="text-right">Margem</span>
                <span className="text-right">Ações</span>
              </div>

              <div className="divide-y divide-[var(--color-border)]">
                {filtered.map(product => {
                  const isInsumo = product.product_type === "insumo";
                  const isComposedProduct = derivedStock[product.id] !== undefined;
                  const margin = product.cost_price > 0
                    ? ((product.sale_price - product.cost_price) / product.cost_price) * 100
                    : 0;

                  // Stock display
                  let stockDisplay: React.ReactNode;
                  let isLow: boolean;
                  if (isComposedProduct) {
                    const avail = derivedStock[product.id];
                    isLow = avail <= 0;
                    stockDisplay = (
                      <span className="flex items-center gap-1 justify-end">
                        <Layers size={12} className="text-[var(--color-primary)] flex-shrink-0" />
                        <span className={`text-sm font-bold tabular-nums ${isLow ? "text-[var(--color-danger)]" : "text-[var(--color-primary)]"}`}>
                          ~{avail}
                        </span>
                        {isLow && <AlertTriangle size={12} className="text-[var(--color-danger)]" />}
                      </span>
                    );
                  } else {
                    isLow = product.stock_quantity <= 5;
                    stockDisplay = (
                      <span className={`text-sm font-bold tabular-nums ${isLow ? "text-[var(--color-warning)]" : "text-[var(--color-text-primary)]"}`}>
                        {formatStock(product.stock_quantity, product.unit)}
                        {isLow && <AlertTriangle size={12} className="inline ml-1" />}
                      </span>
                    );
                  }

                  return (
                    <div key={product.id}
                      className="flex flex-col md:grid md:grid-cols-[1fr_100px_120px_120px_100px_140px] gap-2 md:gap-3 px-5 py-4 hover:bg-[var(--color-surface-elevated)] transition-colors duration-100">

                      {/* Name + badges */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{product.name}</p>
                          {isInsumo && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-warning-subtle)] text-[var(--color-warning)] border border-[var(--color-warning)]/30">
                              <Package size={10} /> Insumo
                            </span>
                          )}
                          {isComposedProduct && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-primary-subtle)] text-[var(--color-primary)] border border-[var(--color-primary)]/30">
                              <Layers size={10} /> Composto
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {product.sku && <span className="text-xs text-[var(--color-text-muted)]">SKU: {product.sku}</span>}
                          <span className="text-xs text-[var(--color-text-muted)]">{product.unit}</span>
                          {!isInsumo && (
                            <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-0.5">
                              <ShoppingCart size={10} /> PDV
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stock */}
                      <div className="flex md:justify-end items-center gap-2 md:gap-0">
                        <span className="md:hidden text-xs text-[var(--color-text-muted)]">Estoque:</span>
                        {stockDisplay}
                      </div>

                      {/* Cost */}
                      <div className="flex md:justify-end items-center gap-2">
                        <span className="md:hidden text-xs text-[var(--color-text-muted)]">Custo:</span>
                        <span className="text-sm tabular-nums text-[var(--color-text-secondary)]">{formatCurrency(product.cost_price)}</span>
                      </div>

                      {/* Price */}
                      <div className="flex md:justify-end items-center gap-2">
                        <span className="md:hidden text-xs text-[var(--color-text-muted)]">Preço:</span>
                        {isInsumo
                          ? <span className="text-xs text-[var(--color-text-muted)] italic">— Insumo</span>
                          : <span className="text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">{formatCurrency(product.sale_price)}</span>
                        }
                      </div>

                      {/* Margin */}
                      <div className="flex md:justify-end items-center gap-2">
                        <span className="md:hidden text-xs text-[var(--color-text-muted)]">Margem:</span>
                        {isInsumo
                          ? <span className="text-xs text-[var(--color-text-muted)]">—</span>
                          : <Badge variant={margin >= 30 ? "success" : margin >= 10 ? "warning" : "danger"}>{margin.toFixed(1)}%</Badge>
                        }
                      </div>

                      {/* Actions */}
                      <div className="flex md:justify-end items-center gap-1.5">
                        {/* Movement button: for insumos and simple products; not for composed products */}
                        {!isComposedProduct && (
                          <button onClick={() => openMovementModal(product)} title={isInsumo ? "Entrada/saída de insumo" : "Movimentar"}
                            className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] transition-all duration-150">
                            <ArrowUpRight size={15} />
                          </button>
                        )}
                        {isComposedProduct && (
                          <div className="w-8 h-8 flex items-center justify-center" title="Estoque gerenciado pelos insumos">
                            <Layers size={15} className="text-[var(--color-text-muted)]" />
                          </div>
                        )}
                        <button onClick={() => openHistoryModal(product)} title="Histórico"
                          className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] transition-all duration-150">
                          <History size={15} />
                        </button>
                        <button onClick={() => openProductModal(product)} title="Editar"
                          className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] transition-all duration-150">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => { setSelectedProduct(product); setModal("delete"); }} title="Excluir"
                          className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] transition-all duration-150">
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

      {/* ── Product modal ── */}
      <Modal open={modal === "product"} onClose={() => setModal(null)} title={selectedProduct ? "Editar item" : "Novo item"} size="lg">
        <form onSubmit={handleSaveProduct} className="flex flex-col gap-4" noValidate>

          {/* Product type toggle */}
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Tipo</p>
            <div className="flex gap-2">
              {([
                { type: "produto", icon: ShoppingCart, label: "Produto", desc: "Aparece no PDV" },
                { type: "insumo",  icon: Package,      label: "Insumo",  desc: "Matéria-prima" },
              ] as const).map(({ type, icon: Icon, label, desc }) => (
                <button key={type} type="button"
                  onClick={() => setProductForm(f => ({ ...f, product_type: type }))}
                  className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-[var(--radius-lg)] border-2 transition-all duration-150 ${
                    productForm.product_type === type
                      ? type === "produto"
                        ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)]"
                        : "border-[var(--color-warning)] bg-[var(--color-warning-subtle)]"
                      : "border-[var(--color-border)] hover:border-[var(--color-primary)]/40"
                  }`}>
                  <Icon size={18} style={{ color: productForm.product_type === type
                    ? type === "produto" ? "var(--color-primary)" : "var(--color-warning)"
                    : "var(--color-text-muted)" }} />
                  <span className={`text-sm font-semibold ${productForm.product_type === type
                    ? type === "produto" ? "text-[var(--color-primary)]" : "text-[var(--color-warning)]"
                    : "text-[var(--color-text-muted)]"}`}>{label}</span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Name + SKU */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nome" required placeholder={isInsumoForm ? "Ex: Açaí" : "Ex: Copo Açaí 300ml"}
              value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} />
            <Input label="SKU / Código" placeholder="Ex: ACA-001"
              value={productForm.sku} onChange={e => setProductForm(f => ({ ...f, sku: e.target.value }))} />
          </div>

          {/* Unit + Cost + Price */}
          <div className={`grid gap-4 ${isInsumoForm ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-3"}`}>
            <Select label={isInsumoForm ? "Unidade de medida" : "Unidade"}
              value={productForm.unit} onChange={e => setProductForm(f => ({ ...f, unit: e.target.value }))}
              options={UNIT_OPTIONS} />
            <Input
              label="Custo unitário"
              type="number" min="0" step="0.01" placeholder="0,00" prefix="R$"
              value={isComposed && components.length > 0 ? computedCost.toFixed(2) : productForm.cost_price}
              disabled={isComposed && components.length > 0}
              onChange={e => setProductForm(f => ({ ...f, cost_price: e.target.value }))}
              helper={isComposed && components.length > 0 ? "Calculado pelos componentes" : undefined}
            />
            {!isInsumoForm && (
              <Input label="Preço de venda" type="number" min="0" step="0.01" placeholder="0,00" prefix="R$"
                value={productForm.sale_price} onChange={e => setProductForm(f => ({ ...f, sale_price: e.target.value }))} />
            )}
          </div>

          {/* Initial stock */}
          {!selectedProduct && (
            <Input
              label={`Estoque inicial${isContinuousUnit ? ` (${productForm.unit})` : ""}`}
              type="number" min="0" step={isContinuousUnit ? "0.001" : "1"} placeholder="0"
              value={productForm.stock_quantity}
              onChange={e => setProductForm(f => ({ ...f, stock_quantity: e.target.value }))}
              helper={isInsumoForm
                ? `Quantidade atual em ${productForm.unit}`
                : "Quantidade disponível ao cadastrar"}
            />
          )}

          {/* Composition section — only for produtos */}
          {!isInsumoForm && (
            <div className="border border-[var(--color-border)] rounded-[var(--radius-lg)] overflow-hidden">
              <button
                type="button"
                onClick={() => setIsComposed(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-[var(--color-surface-elevated)] hover:bg-[var(--color-border)] transition-colors duration-150"
              >
                <div className="flex items-center gap-2">
                  <Layers size={15} className="text-[var(--color-primary)]" />
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">Composição de insumos</span>
                  {(existingComponents.length > 0 || components.length > 0) && (
                    <Badge variant="info">{existingComponents.length + components.length} componente{existingComponents.length + components.length !== 1 ? "s" : ""}</Badge>
                  )}
                </div>
                <span className="text-xs text-[var(--color-text-muted)]">{isComposed ? "Ocultar" : "Expandir"}</span>
              </button>

              {isComposed && (
                <div className="p-4 flex flex-col gap-3">
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Defina os insumos e quantidades que compõem este produto. O estoque disponível será calculado automaticamente com base nos insumos.
                  </p>

                  {/* Existing components */}
                  {existingComponents.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {existingComponents.map(ec => (
                        <div key={ec.id} className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] bg-[var(--color-surface-elevated)]">
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-[var(--color-text-primary)]">{ec.component?.name}</span>
                            {ec.component?.product_type === "insumo" && (
                              <span className="ml-1.5 text-[10px] font-semibold text-[var(--color-warning)] bg-[var(--color-warning-subtle)] px-1 py-0.5 rounded">Insumo</span>
                            )}
                          </div>
                          <span className="text-sm tabular-nums text-[var(--color-text-muted)]">{ec.quantity} {ec.component?.unit}</span>
                          <span className="text-sm tabular-nums text-[var(--color-text-secondary)]">
                            {formatCurrency((ec.component?.cost_price || 0) * ec.quantity)}
                          </span>
                          <button type="button" onClick={() => removeExistingComponent(ec.id)} className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* New components */}
                  {components.map((comp, idx) => (
                    <div key={comp.product_id} className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] bg-[var(--color-primary-subtle)] border border-[var(--color-primary)]/20">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">{comp.product_name}</span>
                        {comp.product_type === "insumo" && (
                          <span className="ml-1.5 text-[10px] font-semibold text-[var(--color-warning)] bg-[var(--color-warning-subtle)] px-1 py-0.5 rounded">Insumo</span>
                        )}
                      </div>
                      <input
                        type="number" min="0.001" step="any"
                        value={comp.quantity}
                        onChange={e => setComponents(prev => prev.map((c, i) => i === idx ? { ...c, quantity: e.target.value } : c))}
                        className="w-24 h-7 px-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)] tabular-nums text-center"
                      />
                      <span className="text-xs text-[var(--color-text-muted)] w-7 text-left">{comp.unit}</span>
                      <button type="button" onClick={() => removeComponent(comp.product_id)} className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">
                        <X size={14} />
                      </button>
                    </div>
                  ))}

                  {/* Cost total */}
                  {(existingComponents.length + components.length) > 0 && (
                    <div className="flex items-center justify-between px-3 py-2 rounded-[var(--radius-md)] bg-[var(--color-surface-elevated)]">
                      <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Custo total</span>
                      <span className="text-sm font-bold tabular-nums text-[var(--color-text-primary)]">
                        {formatCurrency(
                          computedCost +
                          existingComponents.reduce((s, ec) => s + (ec.component?.cost_price || 0) * ec.quantity, 0)
                        )}
                      </span>
                    </div>
                  )}

                  {/* Search component */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar insumo ou produto para adicionar..."
                      value={compSearch}
                      onChange={e => setCompSearch(e.target.value)}
                      className="w-full h-9 px-3 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]"
                    />
                    {compSearch && filteredForComp.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-elevated)] overflow-hidden">
                        {filteredForComp.map(p => (
                          <button key={p.id} type="button" onClick={() => addComponent(p)}
                            className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-[var(--color-surface-elevated)] transition-colors">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-[var(--color-text-primary)]">{p.name}</span>
                              {p.product_type === "insumo" && (
                                <span className="text-[10px] font-semibold text-[var(--color-warning)] bg-[var(--color-warning-subtle)] px-1 py-0.5 rounded">Insumo</span>
                              )}
                            </div>
                            <span className="text-xs text-[var(--color-text-muted)]">{formatCurrency(p.cost_price)}/{p.unit}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {formError && <p role="alert" className="text-sm text-[var(--color-danger)]">{formError}</p>}
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1">Salvar</Button>
          </div>
        </form>
      </Modal>

      {/* ── Movement modal ── */}
      <Modal open={modal === "movement"} onClose={() => setModal(null)}
        title={`${selectedProduct?.product_type === "insumo" ? "Lançar estoque" : "Movimentar"}: ${selectedProduct?.name}`}>
        <form onSubmit={handleSaveMovement} className="flex flex-col gap-4" noValidate>
          <div className="flex gap-2">
            {(["entrada", "saida"] as const).map(t => (
              <button key={t} type="button" onClick={() => setMovementForm(f => ({ ...f, type: t, reason: "" }))}
                className={`flex-1 h-9 flex items-center justify-center gap-2 text-sm font-medium rounded-[var(--radius-md)] border transition-colors duration-150 ${
                  movementForm.type === t
                    ? t === "entrada"
                      ? "bg-[var(--color-success-subtle)] border-[var(--color-success)]/40 text-[var(--color-success)]"
                      : "bg-[var(--color-danger-subtle)] border-[var(--color-danger)]/40 text-[var(--color-danger)]"
                    : "bg-transparent border-[var(--color-border)] text-[var(--color-text-muted)]"
                }`}>
                {t === "entrada" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {t === "entrada"
                  ? selectedProduct?.product_type === "insumo" ? "Recebimento" : "Entrada"
                  : selectedProduct?.product_type === "insumo" ? "Baixa" : "Saída"}
              </button>
            ))}
          </div>

          <div className="px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface-elevated)] text-sm">
            <span className="text-[var(--color-text-muted)]">Estoque atual: </span>
            <span className="font-bold text-[var(--color-text-primary)] tabular-nums">
              {selectedProduct && formatStock(selectedProduct.stock_quantity, selectedProduct.unit)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={`Quantidade${selectedProduct ? ` (${selectedProduct.unit})` : ""}`}
              required
              type="number" min="0.001"
              step={selectedProduct && CONTINUOUS_UNITS.has(selectedProduct.unit) ? "0.001" : "1"}
              placeholder="0"
              value={movementForm.quantity}
              onChange={e => setMovementForm(f => ({ ...f, quantity: e.target.value }))}
            />
            {movementForm.type === "entrada" && (
              <Input label="Custo unitário" type="number" min="0" step="0.01" placeholder="0,00" prefix="R$"
                value={movementForm.unit_cost} onChange={e => setMovementForm(f => ({ ...f, unit_cost: e.target.value }))} />
            )}
          </div>

          <Select label="Motivo" value={movementForm.reason} onChange={e => setMovementForm(f => ({ ...f, reason: e.target.value }))}
            options={[
              { value: "", label: "Selecione..." },
              ...(movementForm.type === "entrada" ? MOVEMENT_REASON_IN : MOVEMENT_REASON_OUT).map(r => ({ value: r, label: r })),
            ]}
          />
          <Input label="Data" type="date" required value={movementForm.date} onChange={e => setMovementForm(f => ({ ...f, date: e.target.value }))} />

          {formError && <p role="alert" className="text-sm text-[var(--color-danger)]">{formError}</p>}
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1">Registrar</Button>
          </div>
        </form>
      </Modal>

      {/* ── History modal ── */}
      <Modal open={modal === "history"} onClose={() => setModal(null)} title={`Histórico: ${selectedProduct?.name}`} size="lg">
        <div className="max-h-96 overflow-y-auto -mx-6 px-6">
          {movements.length === 0 ? (
            <p className="text-sm text-center text-[var(--color-text-muted)] py-8">Nenhuma movimentação registrada.</p>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {movements.map(m => (
                <div key={m.id} className="flex items-center gap-3 py-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: m.type === "entrada" ? "var(--color-success-subtle)" : "var(--color-danger-subtle)" }}>
                    {m.type === "entrada"
                      ? <ArrowUpRight size={14} className="text-[var(--color-income)]" />
                      : <ArrowDownRight size={14} className="text-[var(--color-expense)]" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {m.type === "entrada" ? "+" : "-"}{formatStock(m.quantity, selectedProduct?.unit || "un")}
                      {m.reason && <span className="text-[var(--color-text-muted)] font-normal"> · {m.reason}</span>}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">{formatDate(m.date)}</p>
                  </div>
                  {m.unit_cost && <span className="text-sm tabular-nums text-[var(--color-text-secondary)]">{formatCurrency(m.unit_cost)}/{selectedProduct?.unit}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* ── Delete modal ── */}
      <Modal open={modal === "delete"} onClose={() => setModal(null)} title="Excluir item" size="sm">
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          Excluir <strong>{selectedProduct?.name}</strong>? Todo histórico e composição também será removido.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" loading={saving} onClick={handleDeleteProduct}>Excluir</Button>
        </div>
      </Modal>
    </>
  );
}
