"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { setToken } from "@/lib/auth";
import {
  Loader2,
  LogIn,
  Shield,
  Wrench,
  Sparkles,
  Coffee,
  ConciergeBell,
  LayoutDashboard,
} from "lucide-react";

interface LoginResponse {
  token: string;
  user: { id: string; name: string; role: string; email: string };
}

const demoAccounts = [
  {
    label: "Staff (Maintenance)",
    email: "juan@hotel-mariana.com",
    icon: Wrench,
    role: "staff",
  },
  {
    label: "Staff (Housekeeping)",
    email: "ana@hotel-mariana.com",
    icon: Sparkles,
    role: "staff",
  },
  {
    label: "Staff (Kitchen)",
    email: "yuki@hotel-mariana.com",
    icon: Coffee,
    role: "staff",
  },
  {
    label: "Staff (Concierge)",
    email: "sophie@hotel-mariana.com",
    icon: ConciergeBell,
    role: "staff",
  },
  {
    label: "Manager",
    email: "maria@hotel-mariana.com",
    icon: LayoutDashboard,
    role: "manager",
  },
  {
    label: "Admin",
    email: "admin@hotel-mariana.com",
    icon: Shield,
    role: "admin",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (loginEmail: string, loginPassword: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await apiRequest<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      setToken(res.token);
      router.push("/dashboard");
    } catch {
      setError("Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin(email, password);
  };

  const handleDemoLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("demo2026");
    handleLogin(demoEmail, "demo2026");
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{
        background:
          "radial-gradient(ellipse 50% 40% at 50% 40%, rgba(212,165,116,0.04) 0%, transparent 70%)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-md"
      >
        {/* Logo / Header */}
        <div className="mb-8 text-center">
          <h1 className="font-display text-4xl font-semibold text-[var(--text-primary)]">
            Hospi<span className="text-[var(--accent,#d4a574)]">Q</span>
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Staff Command Center
          </p>
        </div>

        {/* Login card - glass morphism */}
        <div className="rounded-2xl border border-white/10 bg-[var(--bg-secondary)]/80 p-6 backdrop-blur-xl shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Email
              </label>
              <Input
                type="email"
                placeholder="staff@hotel-mariana.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] border-white/10 focus:border-[var(--accent,#d4a574)]"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Password
              </label>
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white/5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] border-white/10 focus:border-[var(--accent,#d4a574)]"
                required
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-[var(--status-danger,#c17767)]"
              >
                {error}
              </motion.p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--accent,#d4a574)] text-[var(--bg-primary)] hover:bg-[var(--accent,#d4a574)]/80 font-semibold"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              Sign In
            </Button>
          </form>

          {/* Demo accounts */}
          <div className="mt-6 border-t border-white/5 pt-5">
            <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
              Demo Accounts
            </p>
            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((account) => (
                <motion.button
                  key={account.email}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleDemoLogin(account.email)}
                  disabled={loading}
                  className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-3 text-left transition-colors hover:border-white/10 hover:bg-white/5 disabled:opacity-50"
                >
                  <account.icon className="h-3.5 w-3.5 shrink-0 text-[var(--accent,#d4a574)]" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                      {account.label}
                    </p>
                    <p className="truncate text-[10px] text-[var(--text-muted)]">
                      {account.role}
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>
            <p className="mt-3 text-center text-[10px] text-[var(--text-muted)]">
              Password: <span className="font-[family-name:var(--font-mono)]">demo2026</span>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
