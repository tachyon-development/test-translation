"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Building2,
  Users,
  Plug,
  ScrollText,
  DoorOpen,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { isAuthenticated, getUser } from "@/lib/auth";
import { AppShell } from "@/components/shared/AppShell";

const adminCards = [
  {
    key: "departments",
    label: "Departments",
    description: "Manage departments, SLA configs, and escalation contacts",
    icon: Building2,
    href: "/admin/departments",
    color: "var(--accent-blue)",
  },
  {
    key: "users",
    label: "Users",
    description: "Invite staff, assign roles, and manage team members",
    icon: Users,
    href: "/admin/users",
    color: "var(--accent-green)",
  },
  {
    key: "rooms",
    label: "Rooms",
    description: "View rooms and generate QR codes for guests",
    icon: DoorOpen,
    href: "/admin/rooms",
    color: "var(--accent-amber)",
  },
  {
    key: "integrations",
    label: "Integrations",
    description: "Connect external services, webhooks, and PMS systems",
    icon: Plug,
    href: "/admin/integrations",
    color: "var(--accent-purple)",
  },
  {
    key: "audit",
    label: "Audit Log",
    description: "Full activity history with timestamps and actors",
    icon: ScrollText,
    href: "/admin/audit",
    color: "var(--status-warning,#c9a84c)",
  },
];

export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    const user = getUser();
    if (user && user.role !== "admin") {
      router.replace("/dashboard");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg-primary)]">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  return (
    <AppShell activePage="admin">
      <main className="flex flex-1 flex-col overflow-auto">
        {/* Header */}
        <header className="border-b border-white/5 px-4 py-6 md:px-8">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2 className="font-display text-2xl font-semibold text-[var(--text-primary)]">
              Admin Settings
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Manage your organization, team, and integrations
            </p>
          </motion.div>
        </header>

        {/* Cards grid */}
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 md:p-8">
          {adminCards.map((card, i) => (
            <motion.button
              key={card.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: i * 0.06,
                type: "spring",
                stiffness: 300,
                damping: 25,
              }}
              whileHover={{ y: -2 }}
              onClick={() => router.push(card.href)}
              className="group flex flex-col items-start gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-6 text-left transition-all duration-200 hover:border-white/10 hover:bg-white/[0.04]"
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-200"
                style={{
                  backgroundColor: `color-mix(in srgb, ${card.color} 12%, transparent)`,
                }}
              >
                <card.icon
                  className="h-5 w-5"
                  style={{ color: card.color }}
                />
              </div>
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                  {card.label}
                  <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)] transition-transform duration-200 group-hover:translate-x-1 group-hover:text-[var(--text-secondary)]" />
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                  {card.description}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
