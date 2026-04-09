"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Activity,
  Menu,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { getUser, clearToken } from "@/lib/auth";

const navItems = [
  { key: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { key: "analytics" as const, label: "Analytics", icon: BarChart3, href: "/analytics" },
  { key: "manager" as const, label: "Manager", icon: Users, href: "/manager" },
  { key: "admin" as const, label: "Admin", icon: Settings, href: "/admin" },
];

interface AppShellProps {
  children: React.ReactNode;
  activePage: "dashboard" | "analytics" | "manager" | "admin";
  headerRight?: React.ReactNode;
  mobileTopBar?: React.ReactNode;
  sidebarExtra?: React.ReactNode;
}

function SidebarContent({
  activePage,
  sidebarExtra,
  onNavigate,
}: {
  activePage: string;
  sidebarExtra?: React.ReactNode;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const user = getUser();

  const handleLogout = () => {
    clearToken();
    router.replace("/login");
  };

  return (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2 border-b border-white/5 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent,#d4a574)]/10">
          <Activity className="h-4 w-4 text-[var(--accent,#d4a574)]" />
        </div>
        <h1 className="font-display text-xl font-bold text-[var(--text-primary)]">
          Hospi<span className="text-[var(--accent,#d4a574)]">Q</span>
        </h1>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-3 py-4">
          {/* Navigation */}
          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = item.key === activePage;
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    if (!isActive) {
                      router.push(item.href);
                    }
                    onNavigate?.();
                  }}
                  className={`
                    flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors
                    ${isActive
                      ? "bg-[var(--accent,#d4a574)]/10 text-[var(--accent,#d4a574)]"
                      : "text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]"
                    }
                  `}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Page-specific sidebar content */}
          {sidebarExtra}
        </div>
      </ScrollArea>

      {/* User info + logout */}
      <div className="border-t border-white/5 p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent,#d4a574)]/10 text-[10px] font-bold text-[var(--accent,#d4a574)]">
            {user?.role?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-[var(--text-primary)]">
              {user?.role ?? "Unknown"}
            </p>
            <p className="truncate text-[10px] text-[var(--text-muted)]">
              {user?.sub?.slice(0, 8) ?? ""}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-white/5 hover:text-[var(--text-primary)]"
            title="Logout"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}

export function AppShell({
  children,
  activePage,
  headerRight,
  mobileTopBar,
  sidebarExtra,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar (hidden on mobile) */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-white/5 bg-[var(--bg-primary)]">
        <SidebarContent activePage={activePage} sidebarExtra={sidebarExtra} />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="flex w-72 flex-col p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent
            activePage={activePage}
            sidebarExtra={sidebarExtra}
            onNavigate={() => setDrawerOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top header (hidden on desktop) */}
        <div className="flex md:hidden items-center justify-between border-b border-white/5 px-4 py-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-white/5 active:text-[var(--accent,#d4a574)]"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="font-display text-lg font-bold text-[var(--text-primary)]">
            Hospi<span className="text-[var(--accent,#d4a574)]">Q</span>
          </h1>
          <div className="flex items-center">
            {headerRight ?? <div className="w-5" />}
          </div>
        </div>

        {/* Mobile top bar (compact KPIs etc.) */}
        {mobileTopBar && (
          <div className="md:hidden border-b border-white/5">
            {mobileTopBar}
          </div>
        )}

        {/* Page content */}
        {children}
      </div>
    </div>
  );
}
