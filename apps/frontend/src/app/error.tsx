"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, RotateCcw } from "lucide-react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: ErrorPageProps) {
  const [showDetails, setShowDetails] = useState(false);
  const isDev = process.env.NODE_ENV === "development";

  useEffect(() => {
    console.error("[RootError]", error);
  }, [error]);

  return (
    <html>
      <body
        style={{ backgroundColor: "#0f0f17", color: "#e8e4df" }}
        className="flex min-h-screen items-center justify-center"
      >
        <div className="mx-auto flex max-w-md flex-col items-center px-6 text-center">
          {/* Icon */}
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#d4a574]/10">
            <AlertTriangle className="h-8 w-8 text-[#d4a574]" />
          </div>

          {/* Title */}
          <h1
            className="mb-2 text-2xl font-semibold"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Something went wrong
          </h1>

          {/* Description */}
          <p className="mb-8 text-sm" style={{ color: "#a0a0b0" }}>
            We hit an unexpected snag. Please try again, and if the issue
            persists, our team is here to help.
          </p>

          {/* Retry button */}
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#d4a574] to-[#c4956a] px-6 py-3 text-sm font-medium text-[#1a1a2e] shadow-[0_0_40px_-8px_rgba(212,165,116,0.35)] transition-all hover:shadow-[0_0_60px_-8px_rgba(212,165,116,0.5)]"
          >
            <RotateCcw className="h-4 w-4" />
            Try again
          </button>

          {/* Dev-only error details */}
          {isDev && (
            <div className="mt-8 w-full">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="inline-flex items-center gap-1.5 text-xs"
                style={{ color: "#6b6b80" }}
              >
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${showDetails ? "rotate-180" : ""}`}
                />
                Error details
              </button>
              {showDetails && (
                <pre
                  className="mt-3 max-h-48 overflow-auto rounded-lg p-4 text-left text-xs"
                  style={{
                    backgroundColor: "#1a1a2e",
                    color: "#a0a0b0",
                    fontFamily: "monospace",
                  }}
                >
                  {error.message}
                  {error.stack && `\n\n${error.stack}`}
                  {error.digest && `\n\nDigest: ${error.digest}`}
                </pre>
              )}
            </div>
          )}
        </div>
      </body>
    </html>
  );
}
