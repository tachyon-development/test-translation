"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Monitor,
  Wrench,
  BarChart3,
  Settings,
  Play,
  Square,
  Info,
  Zap,
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { setToken } from "@/lib/auth";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

interface LoginResponse {
  token: string;
  user: { id: string; name: string; role: string; email: string };
}

const roles = [
  {
    key: "guest",
    label: "Guest Kiosk",
    description: "Submit requests via voice or text",
    icon: Monitor,
    href: "/",
    email: null,
    delay: 0,
  },
  {
    key: "staff",
    label: "Staff Dashboard",
    description: "Real-time task board for Juan",
    icon: Wrench,
    href: "/dashboard",
    email: "juan@hotel-mariana.com",
    delay: 0.08,
  },
  {
    key: "manager",
    label: "Manager Analytics",
    description: "KPIs and SLA tracking for Maria",
    icon: BarChart3,
    href: "/analytics",
    email: "maria@hotel-mariana.com",
    delay: 0.16,
  },
  {
    key: "admin",
    label: "Admin Settings",
    description: "Departments, users, integrations",
    icon: Settings,
    href: "/admin",
    email: "admin@hotel-mariana.com",
    delay: 0.24,
  },
];

const templates = [
  { text: "My faucet is leaking", room: "412", lang: "en" },
  { text: "Necesitamos mas toallas", room: "203", lang: "es" },
  { text: "エアコンが動かない", room: "601", lang: "ja" },
  { text: "Le wifi ne marche pas", room: "302", lang: "fr" },
  { text: "Can someone bring extra pillows?", room: "105", lang: "en" },
  { text: "电视遥控器坏了", room: "501", lang: "zh" },
  { text: "There's a cockroach in my room!", room: "404", lang: "en" },
  { text: "Could you recommend a nearby pharmacy?", room: "201", lang: "en" },
  { text: "Brauchen mehr Kaffee-Pads", room: "315", lang: "de" },
  { text: "Il riscaldamento non funziona", room: "208", lang: "it" },
  { text: "The shower drain is clogged", room: "517", lang: "en" },
  { text: "Preciso de um berco para bebe", room: "110", lang: "pt" },
  { text: "Room safe won't lock", room: "603", lang: "en" },
  { text: "Klimaanlage tropft", room: "422", lang: "de" },
  { text: "Can I get a late checkout?", room: "309", lang: "en" },
  { text: "Les lumieres clignotent", room: "205", lang: "fr" },
];

// Floating particle component
function Particle({ index }: { index: number }) {
  const size = 2 + Math.random() * 3;
  const x = Math.random() * 100;
  const duration = 12 + Math.random() * 18;
  const delay = Math.random() * duration;

  return (
    <motion.div
      className="pointer-events-none absolute rounded-full"
      style={{
        width: size,
        height: size,
        left: `${x}%`,
        background: "radial-gradient(circle, rgba(212,165,116,0.6), transparent)",
      }}
      initial={{ y: "100vh", opacity: 0 }}
      animate={{
        y: "-10vh",
        opacity: [0, 0.8, 0.8, 0],
      }}
      transition={{
        duration,
        delay: delay + index * 0.3,
        repeat: Infinity,
        ease: "linear",
      }}
    />
  );
}

export default function DemoPage() {
  const router = useRouter();
  const [navigating, setNavigating] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simCount, setSimCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up simulation on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleRoleClick = useCallback(
    async (role: (typeof roles)[number]) => {
      setNavigating(role.key);

      if (!role.email) {
        // Guest -- no login needed
        router.push(role.href);
        return;
      }

      try {
        const res = await apiRequest<LoginResponse>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email: role.email,
            password: "demo2026",
          }),
        });
        setToken(res.token);
        router.push(role.href);
      } catch {
        // If login fails, still navigate (may redirect to login)
        router.push(role.href);
      }
    },
    [router]
  );

  const startSimulation = useCallback(() => {
    if (simulating) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      setSimulating(false);
      return;
    }

    setSimulating(true);
    setSimCount(0);

    const fire = async () => {
      const t = templates[Math.floor(Math.random() * templates.length)];
      try {
        await apiRequest("/api/requests", {
          method: "POST",
          body: JSON.stringify({
            text: t.text,
            room_number: t.room,
            org_id: ORG_ID,
            lang: t.lang,
          }),
        });
        setSimCount((c) => c + 1);
      } catch {
        // ignore errors during simulation
      }
    };

    // Fire one immediately
    fire();
    setSimCount(1);
    intervalRef.current = setInterval(fire, 5000);
  }, [simulating]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg-primary)]">
      {/* Floating particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <Particle key={i} index={i} />
        ))}
      </div>

      {/* Warm radial glow behind cards */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 50%, rgba(212,165,116,0.07) 0%, transparent 70%)",
        }}
      />

      {/* Second subtle glow layer */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle 400px at 50% 60%, rgba(212,165,116,0.04) 0%, transparent 100%)",
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center px-6 py-16">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="mb-4 text-center"
        >
          <h1
            className="font-display text-7xl font-bold tracking-tight text-[var(--text-primary)] sm:text-8xl"
            style={{
              textShadow:
                "0 0 80px rgba(212,165,116,0.25), 0 0 160px rgba(212,165,116,0.1)",
            }}
          >
            Hospi<span className="text-[var(--accent,#d4a574)]">Q</span>
          </h1>
        </motion.div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 20 }}
          className="mb-12 text-center text-lg text-[var(--text-muted)] sm:text-xl"
        >
          Real-Time AI-Powered Hospitality
        </motion.p>

        {/* Choose a role */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8 text-sm font-medium uppercase tracking-[0.2em] text-[var(--text-secondary)]"
        >
          Choose a role to explore
        </motion.p>

        {/* Role cards grid */}
        <div className="mb-12 grid w-full grid-cols-2 gap-4 sm:grid-cols-4">
          {roles.map((role) => (
            <motion.button
              key={role.key}
              data-testid="role-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.3 + role.delay,
                type: "spring",
                stiffness: 300,
                damping: 25,
              }}
              whileHover={{ scale: 1.05, y: -4 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleRoleClick(role)}
              disabled={navigating !== null}
              className="group relative flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center backdrop-blur-xl transition-all duration-300 hover:border-[var(--accent,#d4a574)]/30 hover:bg-white/[0.06] hover:shadow-[0_0_60px_-12px_rgba(212,165,116,0.25)] disabled:opacity-60"
            >
              {/* Glow overlay on hover */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{
                background: "radial-gradient(circle at 50% 30%, rgba(212,165,116,0.08) 0%, transparent 70%)",
              }} />

              <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent,#d4a574)]/10 transition-all duration-300 group-hover:bg-[var(--accent,#d4a574)]/20 group-hover:shadow-[0_0_30px_-6px_rgba(212,165,116,0.3)]">
                {navigating === role.key ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="h-5 w-5 rounded-full border-2 border-[var(--accent,#d4a574)] border-t-transparent"
                  />
                ) : (
                  <role.icon className="h-5 w-5 text-[var(--accent,#d4a574)]" />
                )}
              </div>

              <div className="relative">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {role.label}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-[var(--text-muted)]">
                  {role.description}
                </p>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Simulation button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mb-8 flex flex-col items-center gap-3"
        >
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={startSimulation}
            className={`
              relative flex items-center gap-2.5 rounded-xl px-8 py-3.5 text-sm font-semibold tracking-wide transition-all duration-300
              ${
                simulating
                  ? "border border-[var(--status-danger,#c17767)]/30 bg-[var(--status-danger,#c17767)]/10 text-[var(--status-danger,#c17767)]"
                  : "bg-gradient-to-r from-[var(--accent,#d4a574)] to-[var(--accent-dark,#c4956a)] text-[#1a1a2e] shadow-[0_0_50px_-10px_rgba(212,165,116,0.4)]"
              }
            `}
          >
            {!simulating && (
              <motion.div
                className="pointer-events-none absolute inset-0 rounded-xl"
                animate={{
                  boxShadow: [
                    "0 0 20px -5px rgba(212,165,116,0.3)",
                    "0 0 40px -5px rgba(212,165,116,0.5)",
                    "0 0 20px -5px rgba(212,165,116,0.3)",
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
            {simulating ? (
              <Square className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {simulating ? "Stop Simulation" : "Run Simulation"}
          </motion.button>

          <AnimatePresence>
            {simulating && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"
              >
                <Zap className="h-3.5 w-3.5 text-[var(--accent,#d4a574)]" />
                <span>
                  <span className="font-mono font-bold text-[var(--accent,#d4a574)]">
                    {simCount}
                  </span>{" "}
                  request{simCount !== 1 ? "s" : ""} fired
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Tips callout */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="w-full max-w-md rounded-xl border border-[var(--accent,#d4a574)]/15 bg-[var(--accent,#d4a574)]/[0.04] px-5 py-4 backdrop-blur-xl"
        >
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent,#d4a574)]" />
            <div className="text-sm leading-relaxed text-[var(--text-secondary)]">
              <p className="mb-1 font-medium text-[var(--text-primary)]">
                Try this for the best demo:
              </p>
              <p>
                Open two browser windows side-by-side -- a{" "}
                <span className="font-semibold text-[var(--accent,#d4a574)]">Guest Kiosk</span>{" "}
                and the{" "}
                <span className="font-semibold text-[var(--accent,#d4a574)]">Staff Dashboard</span>
                . Submit a request from the kiosk and watch it appear in
                real-time on the dashboard.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
