"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { ToastProvider } from "@/components/ui/toast";
import { MobileMenuContext } from "@/lib/mobile-menu-context";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <ToastProvider>
      <MobileMenuContext.Provider value={() => setMobileOpen(true)}>
        <div className="flex h-dvh overflow-hidden bg-[var(--color-bg)]">
          <Sidebar
            companyName="Minha Empresa"
            mobileOpen={mobileOpen}
            onMobileClose={() => setMobileOpen(false)}
          />
          <main
            id="main-content"
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>
          </main>
        </div>
      </MobileMenuContext.Provider>
    </ToastProvider>
  );
}
