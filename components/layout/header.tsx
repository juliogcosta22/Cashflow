"use client";

import { Menu } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
  children?: React.ReactNode;
}

export function Header({ title, subtitle, onMenuClick, children }: HeaderProps) {
  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b border-[var(--color-border)] bg-[var(--color-bg)] sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          aria-label="Abrir menu"
          className="lg:hidden w-9 h-9 flex items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)] transition-colors duration-150"
        >
          <Menu size={20} />
        </button>
        <div>
          <h1 className="text-base font-semibold text-[var(--color-text-primary)] leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-[var(--color-text-muted)]">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {children}
        <ThemeToggle />
      </div>
    </header>
  );
}
