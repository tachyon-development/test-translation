"use client";

import { motion } from "framer-motion";

interface RoomSelectorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function RoomSelector({ value, onChange, error }: RoomSelectorProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 3);
    onChange(v);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.2 }}
      className="w-full"
    >
      <label
        htmlFor="room-number"
        className="mb-2 block text-sm tracking-wide text-[var(--text-secondary)]"
      >
        Room Number
      </label>
      <div className="relative">
        <input
          id="room-number"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={3}
          placeholder="412"
          value={value}
          onChange={handleChange}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-2xl tracking-widest text-[var(--text-primary)] placeholder:text-[var(--text-muted)] backdrop-blur-xl transition-all duration-300 focus:border-[var(--accent)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:shadow-[0_0_40px_-8px_rgba(212,165,116,0.25)]"
        />
      </div>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-sm text-[var(--status-danger)]"
        >
          {error}
        </motion.p>
      )}
    </motion.div>
  );
}
