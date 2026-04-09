"use client";

import { motion } from "framer-motion";

interface Step {
  label: string;
  detail?: string;
}

interface ProgressStepperProps {
  currentStep: number;
  steps: Step[];
}

function CheckIcon() {
  return (
    <motion.svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      className="absolute"
    >
      <motion.path
        d="M2.5 7.5L5.5 10.5L11.5 3.5"
        stroke="var(--status-success)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20, duration: 0.5 }}
      />
    </motion.svg>
  );
}

function StepCircle({ status }: { status: "pending" | "active" | "complete" }) {
  if (status === "complete") {
    return (
      <motion.div
        className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--status-success)] bg-[var(--status-success)]/10"
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
      >
        <CheckIcon />
      </motion.div>
    );
  }

  if (status === "active") {
    return (
      <motion.div
        className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--accent)] bg-[var(--accent)]/10"
        animate={{
          boxShadow: [
            "0 0 0px 0px rgba(212,165,116,0.0)",
            "0 0 20px 4px rgba(212,165,116,0.3)",
            "0 0 0px 0px rgba(212,165,116,0.0)",
          ],
        }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Half-filled spinner */}
        <motion.div
          className="h-3.5 w-3.5 rounded-full border-2 border-[var(--accent)] border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </motion.div>
    );
  }

  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--text-muted)]/30 bg-transparent">
      <div className="h-2 w-2 rounded-full bg-[var(--text-muted)]/20" />
    </div>
  );
}

function Connector({ filled }: { filled: boolean }) {
  return (
    <div className="relative ml-[15px] h-8 w-0.5 bg-[var(--text-muted)]/15">
      <motion.div
        className="absolute left-0 top-0 w-full bg-[var(--status-success)]"
        initial={{ height: "0%" }}
        animate={{ height: filled ? "100%" : "0%" }}
        transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.1 }}
      />
    </div>
  );
}

function MobileDot({ status }: { status: "pending" | "active" | "complete" }) {
  const bg =
    status === "complete"
      ? "bg-[var(--status-success)]"
      : status === "active"
        ? "bg-[var(--accent)]"
        : "bg-[var(--text-muted)]/30";

  return (
    <div className={`h-4 w-4 rounded-full ${bg} ${status === "active" ? "ring-2 ring-[var(--accent)]/40" : ""}`} />
  );
}

export function ProgressStepper({ currentStep, steps }: ProgressStepperProps) {
  return (
    <motion.div
      data-testid="progress-stepper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-sm"
    >
      {/* Mobile horizontal dots (below sm) */}
      <div className="flex items-center justify-center gap-2 sm:hidden">
        {steps.map((step, i) => {
          const status: "pending" | "active" | "complete" =
            i < currentStep ? "complete" : i === currentStep ? "active" : "pending";
          return (
            <div key={step.label} className="flex items-center gap-2">
              <MobileDot status={status} />
              {i < steps.length - 1 && (
                <div
                  className="h-0.5 w-4"
                  style={{
                    backgroundColor: i < currentStep ? "var(--status-success)" : "rgba(107,107,128,0.3)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop vertical layout (sm and above) */}
      <div className="hidden sm:block">
        {steps.map((step, i) => {
          const status: "pending" | "active" | "complete" =
            i < currentStep ? "complete" : i === currentStep ? "active" : "pending";

          return (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 30,
                delay: i * 0.2,
              }}
            >
              <div className="flex items-center gap-4">
                <StepCircle status={status} />
                <div className="flex flex-col">
                  <span
                    className={`text-sm font-medium transition-colors duration-300 ${
                      status === "complete"
                        ? "text-[var(--status-success)]"
                        : status === "active"
                          ? "text-[var(--accent)]"
                          : "text-[var(--text-muted)]"
                    }`}
                  >
                    {step.label}
                  </span>
                  {step.detail && status === "active" && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="font-mono text-xs text-[var(--text-secondary)]"
                    >
                      {step.detail}
                    </motion.span>
                  )}
                </div>
              </div>
              {i < steps.length - 1 && (
                <Connector filled={i < currentStep} />
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
