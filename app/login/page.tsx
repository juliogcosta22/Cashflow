"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Building2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("E-mail ou senha incorretos. Tente novamente.");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--color-bg)]">
      {/* Top bar */}
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>

      {/* Center content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-[var(--radius-xl)] bg-[var(--color-primary)] flex items-center justify-center mb-4 shadow-lg">
              <Building2 size={24} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">
              Caixa
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Controle financeiro empresarial
            </p>
          </div>

          {/* Form card */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xl)] p-6 shadow-[var(--shadow-elevated)]">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-6">
              Entrar na sua conta
            </h2>

            <form onSubmit={handleLogin} className="flex flex-col gap-4" noValidate>
              <Input
                label="E-mail"
                type="email"
                placeholder="empresa@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />

              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-sm font-medium text-[var(--color-text-primary)]">
                  Senha <span className="text-[var(--color-danger)]">*</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full h-10 px-3 pr-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-colors duration-150 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-3 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="px-3 py-2.5 rounded-[var(--radius-md)] bg-[var(--color-danger-subtle)] border border-[var(--color-danger)]/20 text-sm text-[var(--color-danger)]"
                >
                  {error}
                </div>
              )}

              <Button type="submit" size="lg" loading={loading} className="w-full mt-1">
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </div>

          <p className="text-center text-xs text-[var(--color-text-muted)] mt-6">
            Sem conta? Fale com o administrador da sua empresa.
          </p>
        </div>
      </div>
    </div>
  );
}
