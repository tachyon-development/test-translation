"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { submitTextRequest } from "@/lib/api";
import { useSSE, type SSEEvent } from "@/hooks/useSSE";
import { RoomSelector } from "@/components/kiosk/RoomSelector";
import { ProgressStepper } from "@/components/kiosk/ProgressStepper";
import { FeedbackPrompt } from "@/components/kiosk/FeedbackPrompt";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

const STEPS = [
  { label: "Received" },
  { label: "Transcribing" },
  { label: "Understanding" },
  { label: "Routing" },
  { label: "Assigned" },
  { label: "Resolved" },
];

function mapEventToStep(event: SSEEvent): number {
  switch (event.type) {
    case "connected":
      return 0;
    case "processing":
      if (event.step === "transcribing") return 1;
      if (event.step === "classifying") return 2;
      return 1;
    case "classified":
      return 2;
    case "routed":
      return 3;
    case "resolved":
      return 5;
    default:
      if (event.assignedTo) return 4;
      return -1;
  }
}

// Typewriter effect component
function TypewriterText({ text, className }: { text: string; className?: string }) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    setDisplayed("");
    if (!text) return;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <span className={className}>
      {displayed}
      {displayed.length < text.length && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          className="inline-block w-[2px] h-[1em] bg-[var(--accent)] ml-0.5 align-text-bottom"
        />
      )}
    </span>
  );
}

type ViewState = "input" | "processing" | "resolved";

export default function KioskPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
          <span className="font-display text-lg tracking-[0.3em] uppercase text-[var(--accent)]">
            HospiQ
          </span>
        </main>
      }
    >
      <KioskInner />
    </Suspense>
  );
}

function KioskInner() {
  const searchParams = useSearchParams();

  const [room, setRoom] = useState(searchParams.get("room") || "");
  const [requestText, setRequestText] = useState("");
  const [roomError, setRoomError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [viewState, setViewState] = useState<ViewState>("input");
  const [currentStep, setCurrentStep] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

  const { latestEvent } = useSSE(requestId);

  // Process SSE events
  useEffect(() => {
    if (!latestEvent) return;

    const step = mapEventToStep(latestEvent);
    if (step >= 0) {
      setCurrentStep(step);
    }

    if (latestEvent.message) {
      setStatusMessage(latestEvent.message as string);
    }

    if (latestEvent.type === "resolved") {
      setViewState("resolved");
      if (latestEvent.message) {
        setStatusMessage(latestEvent.message as string);
      } else {
        setStatusMessage("Your request has been fulfilled. Thank you.");
      }
    }
  }, [latestEvent]);

  const handleSubmit = useCallback(async () => {
    // Validate
    if (!/^\d{3}$/.test(room)) {
      setRoomError("Please enter a 3-digit room number");
      return;
    }
    if (!requestText.trim()) return;

    setRoomError("");
    setSubmitting(true);

    try {
      const { request_id } = await submitTextRequest({
        text: requestText.trim(),
        room_number: room,
        org_id: ORG_ID,
      });
      setRequestId(request_id);
      setViewState("processing");
      setCurrentStep(0);
      setStatusMessage("Your request has been received...");
    } catch {
      setStatusMessage("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [room, requestText]);

  const handleReset = () => {
    setViewState("input");
    setRequestId(null);
    setRequestText("");
    setCurrentStep(0);
    setStatusMessage("");
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg-primary)]">
      {/* Warm radial glow background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 45%, rgba(212,165,116,0.06) 0%, rgba(15,15,23,0) 70%)",
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-col items-center px-6 py-12">
        <AnimatePresence mode="wait">
          {/* ─── INPUT STATE ─── */}
          {viewState === "input" && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 250, damping: 25 }}
              className="flex w-full flex-col items-center gap-8"
            >
              {/* Logo / Title */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 20,
                  delay: 0.05,
                }}
                className="text-center"
              >
                <h1 className="font-display text-lg font-semibold tracking-[0.3em] uppercase text-[var(--accent)]">
                  HospiQ
                </h1>
                <p className="font-display mt-3 text-4xl font-normal leading-snug text-[var(--text-primary)] sm:text-5xl">
                  How can we
                  <br />
                  help you?
                </p>
              </motion.div>

              {/* Room Selector */}
              <RoomSelector value={room} onChange={setRoom} error={roomError} />

              {/* Request Text Area */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                  delay: 0.3,
                }}
                className="w-full"
              >
                <label
                  htmlFor="request-text"
                  className="mb-2 block text-sm tracking-wide text-[var(--text-secondary)]"
                >
                  How can we assist you?
                </label>
                <textarea
                  id="request-text"
                  rows={4}
                  placeholder="I need extra towels, the AC seems a bit warm, or anything else..."
                  value={requestText}
                  onChange={(e) => setRequestText(e.target.value)}
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] backdrop-blur-xl transition-all duration-300 focus:border-[var(--accent)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:shadow-[0_0_40px_-8px_rgba(212,165,116,0.25)]"
                />
              </motion.div>

              {/* Submit Button */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                  delay: 0.4,
                }}
                className="w-full"
              >
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={submitting || !requestText.trim()}
                  onClick={handleSubmit}
                  className="w-full rounded-xl bg-gradient-to-r from-[#d4a574] to-[#c4956a] px-8 py-4 text-base font-medium tracking-wide text-[#1a1a2e] shadow-[0_0_40px_-8px_rgba(212,165,116,0.35)] transition-all duration-300 hover:shadow-[0_0_60px_-8px_rgba(212,165,116,0.5)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                >
                  {submitting ? (
                    <motion.span
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      Submitting...
                    </motion.span>
                  ) : (
                    "Submit Request"
                  )}
                </motion.button>
              </motion.div>
            </motion.div>
          )}

          {/* ─── PROCESSING STATE ─── */}
          {viewState === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 250, damping: 25 }}
              className="flex w-full flex-col items-center gap-10"
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-center"
              >
                <h2 className="font-display text-3xl text-[var(--text-primary)]">
                  We are on it
                </h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Room {room}
                </p>
              </motion.div>

              {/* Progress Stepper */}
              <div className="flex w-full justify-center">
                <ProgressStepper currentStep={currentStep} steps={STEPS} />
              </div>

              {/* Status message with typewriter effect */}
              {statusMessage && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-xl border border-white/5 bg-white/[0.03] px-6 py-4 text-center backdrop-blur-xl"
                >
                  <TypewriterText
                    text={statusMessage}
                    className="font-mono text-sm text-[var(--text-secondary)]"
                  />
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ─── RESOLVED STATE ─── */}
          {viewState === "resolved" && requestId && (
            <motion.div
              key="resolved"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: "spring", stiffness: 250, damping: 25 }}
              className="flex w-full flex-col items-center gap-8"
            >
              {/* Success Icon */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-[var(--status-success)] bg-[var(--status-success)]/10 shadow-[0_0_40px_-8px_rgba(124,152,133,0.3)]"
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--status-success)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <motion.path
                    d="M4 12l5 5L20 6"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                  />
                </svg>
              </motion.div>

              <div className="text-center">
                <h2 className="font-display text-3xl text-[var(--text-primary)]">
                  All Set
                </h2>
                {statusMessage && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="mt-3 text-base text-[var(--text-secondary)]"
                  >
                    {statusMessage}
                  </motion.p>
                )}
              </div>

              {/* Feedback */}
              <FeedbackPrompt requestId={requestId} />

              {/* New request */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleReset}
                className="mt-4 rounded-xl border border-white/10 bg-white/5 px-8 py-3 text-sm text-[var(--text-secondary)] backdrop-blur-xl transition-colors hover:border-[var(--accent)]/30 hover:text-[var(--text-primary)]"
              >
                New Request
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
