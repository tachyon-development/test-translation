"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface FeedbackPromptProps {
  requestId: string;
  onSubmit?: (rating: "up" | "down") => void;
}

export function FeedbackPrompt({ requestId, onSubmit }: FeedbackPromptProps) {
  const [submitted, setSubmitted] = useState(false);
  const [selected, setSelected] = useState<"up" | "down" | null>(null);

  const handleFeedback = (rating: "up" | "down") => {
    setSelected(rating);
    setSubmitted(true);
    onSubmit?.(rating);
    // Fire-and-forget API call
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL || ""}/api/requests/${requestId}/feedback`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      }
    ).catch(() => {
      // silently ignore
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="mt-8 flex flex-col items-center gap-4"
    >
      {!submitted ? (
        <>
          <p className="text-center text-sm text-[var(--text-secondary)]">
            How was your experience?
          </p>
          <div className="flex gap-4">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleFeedback("up")}
              className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl backdrop-blur-xl transition-colors hover:border-[var(--status-success)]/40 hover:bg-[var(--status-success)]/10"
              aria-label="Thumbs up"
            >
              <span role="img" aria-hidden="true">
                👍
              </span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleFeedback("down")}
              className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl backdrop-blur-xl transition-colors hover:border-[var(--status-danger)]/40 hover:bg-[var(--status-danger)]/10"
              aria-label="Thumbs down"
            >
              <span role="img" aria-hidden="true">
                👎
              </span>
            </motion.button>
          </div>
        </>
      ) : (
        <motion.p
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="text-center text-sm text-[var(--accent)]"
        >
          {selected === "up"
            ? "Thank you for your kind feedback."
            : "We appreciate your honesty. We will do better."}
        </motion.p>
      )}
    </motion.div>
  );
}
