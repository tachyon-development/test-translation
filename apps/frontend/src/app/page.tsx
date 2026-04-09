"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { submitTextRequest, submitVoiceRequest } from "@/lib/api";
import { useSSE, type SSEEvent } from "@/hooks/useSSE";
import { RoomSelector } from "@/components/kiosk/RoomSelector";
import { VoiceRecorder } from "@/components/kiosk/VoiceRecorder";
import { ProgressStepper } from "@/components/kiosk/ProgressStepper";
import { FeedbackPrompt } from "@/components/kiosk/FeedbackPrompt";
import { Wifi, WifiOff, X } from "lucide-react";

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

// Toast notification component
function Toast({
  message,
  type = "error",
  onDismiss,
  onRetry,
}: {
  message: string;
  type?: "error" | "info";
  onDismiss: () => void;
  onRetry?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className={`
        fixed bottom-6 left-1/2 z-50 -translate-x-1/2
        flex items-center gap-3 rounded-xl border px-5 py-3 shadow-2xl backdrop-blur-xl
        ${type === "error"
          ? "border-[var(--status-danger,#c17767)]/20 bg-[var(--status-danger,#c17767)]/10 text-[var(--text-primary)]"
          : "border-white/10 bg-white/5 text-[var(--text-primary)]"
        }
      `}
    >
      <span className="text-sm">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="whitespace-nowrap rounded-lg bg-[var(--accent,#d4a574)] px-3 py-1 text-xs font-medium text-[#1a1a2e] transition-colors hover:bg-[var(--accent,#d4a574)]/80"
        >
          Retry
        </button>
      )}
      <button
        onClick={onDismiss}
        className="ml-1 rounded p-0.5 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}

// SSE connection status badge for kiosk processing view
function SSEConnectionBadge({ connected }: { connected: boolean }) {
  if (connected) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 rounded-full border border-[var(--status-warning,#c9a84c)]/20 bg-[var(--status-warning,#c9a84c)]/10 px-3 py-1.5 text-xs text-[var(--status-warning,#c9a84c)]"
    >
      <WifiOff className="h-3 w-3 animate-pulse" />
      Reconnecting...
    </motion.div>
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
  const [transcript, setTranscript] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [detectedLang, setDetectedLang] = useState("");
  const [department, setDepartment] = useState("");
  const [toast, setToast] = useState<{ message: string; retryable: boolean } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { latestEvent, connected: sseConnected } = useSSE(requestId);

  // Auto-dismiss toast after 6 seconds
  const showToast = useCallback((message: string, retryable = false) => {
    setToast({ message, retryable });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 6000);
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
  }, []);

  // Process SSE events
  useEffect(() => {
    if (!latestEvent) return;

    const step = mapEventToStep(latestEvent);
    if (step >= 0) {
      setCurrentStep(step);
    }

    // Capture transcript from Whisper
    if (latestEvent.type === "transcribed" && latestEvent.text) {
      setTranscript(latestEvent.text as string);
      if (latestEvent.lang) setDetectedLang(latestEvent.lang as string);
      setStatusMessage("Transcribed! Now understanding your request...");
    }

    // Capture classification details
    if (latestEvent.type === "classified" || latestEvent.type === "routed") {
      if (latestEvent.department) setDepartment(latestEvent.department as string);
      if (latestEvent.summary) setTranslatedText(latestEvent.summary as string);
    }

    if (latestEvent.type === "routed") {
      setStatusMessage(`Routed to ${latestEvent.department || "the right team"}. Help is on the way!`);
    }

    if (latestEvent.message) {
      setStatusMessage(latestEvent.message as string);
    }

    if (latestEvent.type === "resolved") {
      setViewState("resolved");
      setStatusMessage(latestEvent.message as string || "Your request has been fulfilled. Thank you.");
    }
  }, [latestEvent]);

  // Inline room validation on blur — only show error if they typed something invalid
  const validateRoom = useCallback((value: string) => {
    if (value.length > 0 && value.length < 3) {
      setRoomError("Room number must be 3 digits");
    } else {
      setRoomError("");
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!requestText.trim()) return;

    // Default to room 101 (Lobby) if no room specified
    const roomNumber = room.length === 3 ? room : "101";
    setRoomError("");
    setSubmitting(true);

    try {
      const { request_id } = await submitTextRequest({
        text: requestText.trim(),
        room_number: roomNumber,
        org_id: ORG_ID,
      });
      setRequestId(request_id);
      setViewState("processing");
      setCurrentStep(0);
      setStatusMessage("Your request has been received...");
    } catch {
      showToast("Could not submit your request. Please check your connection and try again.", true);
    } finally {
      setSubmitting(false);
    }
  }, [room, requestText, showToast]);

  const handleVoiceComplete = useCallback(
    async (audioBlob: Blob) => {
      setSubmitting(true);

      try {
        // Send audio to Whisper for transcription only — don't auto-submit
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");
        formData.append("room_number", room || "101");
        formData.append("org_id", ORG_ID);

        const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
        const res = await fetch(`${API_BASE}/api/requests/voice`, {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const { request_id } = await res.json();
          // Start listening for transcription result via SSE
          setRequestId(request_id);
          setViewState("processing");
          setCurrentStep(0);
          setStatusMessage("Transcribing your voice...");
        } else {
          showToast("Could not process your voice. Please type your request instead.", true);
        }
      } catch {
        showToast("Could not process your voice. Please type your request instead.", true);
      } finally {
        setSubmitting(false);
      }
    },
    [room, showToast]
  );

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
              <RoomSelector
                value={room}
                onChange={(v) => { setRoom(v); setRoomError(""); }}
                error={roomError}
              />

              {/* Voice Recorder */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                  delay: 0.25,
                }}
                className="w-full"
              >
                <VoiceRecorder
                  onRecordingComplete={handleVoiceComplete}
                  disabled={submitting}
                />
              </motion.div>

              {/* Divider */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex w-full items-center gap-4"
              >
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-xs tracking-widest uppercase text-[var(--text-muted)]">
                  or type your request
                </span>
                <div className="h-px flex-1 bg-white/10" />
              </motion.div>

              {/* Request Text Area */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                  delay: 0.35,
                }}
                className="w-full"
              >
                <textarea
                  id="request-text"
                  data-testid="request-input"
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
                  delay: 0.45,
                }}
                className="w-full"
              >
                <motion.button
                  data-testid="submit-button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={submitting || !requestText.trim()}
                  onClick={handleSubmit}
                  className="w-full rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-dark)] px-8 py-4 text-base font-medium tracking-wide text-[#1a1a2e] shadow-[0_0_40px_-8px_rgba(212,165,116,0.35)] transition-all duration-300 hover:shadow-[0_0_60px_-8px_rgba(212,165,116,0.5)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
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

              {/* SSE connection status */}
              <SSEConnectionBadge connected={sseConnected} />

              {/* Progress Stepper */}
              <div className="flex w-full justify-center">
                <ProgressStepper currentStep={currentStep} steps={STEPS} />
              </div>

              {/* Live details panel */}
              <div className="w-full space-y-3">
                {/* Transcript */}
                {transcript && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-white/5 bg-white/[0.03] px-5 py-3 backdrop-blur-xl"
                  >
                    <p className="mb-1 text-xs uppercase tracking-wider text-[var(--text-secondary)]">
                      Transcribed {detectedLang ? `(${detectedLang})` : ""}
                    </p>
                    <p className="font-mono text-sm text-[var(--text-primary)]">&ldquo;{transcript}&rdquo;</p>
                  </motion.div>
                )}

                {/* Translation / Classification */}
                {department && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 px-5 py-3 backdrop-blur-xl"
                  >
                    <p className="mb-1 text-xs uppercase tracking-wider text-[var(--accent)]">
                      Routed to {department}
                    </p>
                    {translatedText && (
                      <p className="text-sm text-[var(--text-secondary)]">{translatedText}</p>
                    )}
                  </motion.div>
                )}

                {/* Status message */}
                {statusMessage && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-xl border border-white/5 bg-white/[0.03] px-5 py-3 text-center backdrop-blur-xl"
                  >
                    <TypewriterText
                      text={statusMessage}
                      className="font-mono text-sm text-[var(--text-secondary)]"
                    />
                  </motion.div>
                )}
              </div>
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

      {/* Error toast */}
      <AnimatePresence>
        {toast && (
          <Toast
            message={toast.message}
            type="error"
            onDismiss={dismissToast}
            onRetry={toast.retryable ? handleSubmit : undefined}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
