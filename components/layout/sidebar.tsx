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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/caixa", label: "Caixa", icon: Wallet },
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

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-60 z-50 flex flex-col bg-[var(--color-sidebar-bg)] transition-transform duration-200",
          "lg:translate-x-0 lg:static lg:z-auto",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo / Company */}
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

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5" aria-label="Navegação principal">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onMobileClose}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 h-10 rounded-[var(--radius-md)] text-sm font-medium transition-colors duration-150",
                  active
                    ? "bg-[var(--color-sidebar-active)] text-[var(--color-sidebar-text-active)]"
                    : "text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-hover)] hover:text-white"
                )}
              >
                <Icon size={17} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
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
