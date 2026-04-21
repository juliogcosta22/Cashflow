"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  Package,
  Calculator,
  LogOut,
  Building2,
  X,
  ShoppingCart,
  BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pdv", label: "PDV", icon: ShoppingCart, highlight: true },
];

const secondaryItems = [
  { href: "/fluxo", label: "Fluxo de Caixa", icon: BarChart2 },
  { href: "/caixa", label: "Caixa Manual", icon: Wallet },
  { href: "/estoque", label: "Estoque", icon: Package },
  { href: "/precificacao", label: "Precificação", icon: Calculator },
];

interface SidebarProps {
  companyName: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ companyName, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-60 z-50 flex flex-col bg-[var(--color-sidebar-bg)] transition-transform duration-200",
          "lg:translate-x-0 lg:static lg:z-auto",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--color-primary)] flex items-center justify-center flex-shrink-0">
              <Building2 size={16} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-white truncate">{companyName}</span>
          </div>
          <button
            onClick={onMobileClose}
            aria-label="Fechar menu"
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded text-white/50 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto" aria-label="Navegação principal">
          {/* Primary nav */}
          {navItems.map(({ href, label, icon: Icon, highlight }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onMobileClose}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 h-10 rounded-[var(--radius-md)] text-sm font-medium transition-colors duration-150",
                  active
                    ? "bg-[var(--color-sidebar-active)] text-white"
                    : highlight
                    ? "text-white bg-[var(--color-primary)]/20 hover:bg-[var(--color-primary)]/30"
                    : "text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-hover)] hover:text-white"
                )}
              >
                <Icon size={17} />
                {label}
                {highlight && !active && (
                  <span className="ml-auto text-[10px] font-bold bg-[var(--color-primary)] text-white px-1.5 py-0.5 rounded-full">
                    PDV
                  </span>
                )}
              </Link>
            );
          })}

          {/* Divider */}
          <div className="my-2 border-t border-white/10" />

          {/* Secondary nav */}
          {secondaryItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onMobileClose}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 h-10 rounded-[var(--radius-md)] text-sm font-medium transition-colors duration-150",
                  active
                    ? "bg-[var(--color-sidebar-active)] text-white"
                    : "text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-hover)] hover:text-white"
                )}
              >
                <Icon size={17} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 h-10 w-full rounded-[var(--radius-md)] text-sm font-medium text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-hover)] hover:text-white transition-colors duration-150"
          >
            <LogOut size={17} />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
