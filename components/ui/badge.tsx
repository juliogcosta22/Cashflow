import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "danger" | "warning" | "info";

const variants: Record<BadgeVariant, string> = {
  default: "bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]",
  success: "bg-[var(--color-success-subtle)] text-[var(--color-success)]",
  danger: "bg-[var(--color-danger-subtle)] text-[var(--color-danger)]",
  warning: "bg-[var(--color-warning-subtle)] text-[var(--color-warning)]",
  info: "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]",
};

export function Badge({
  variant = "default",
  className,
  children,
}: {
  variant?: BadgeVariant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
