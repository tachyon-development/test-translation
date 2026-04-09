"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic } from "lucide-react";
import { WaveformVisualizer } from "./WaveformVisualizer";

type RecordingState = "idle" | "recording" | "processing";

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  disabled?: boolean;
}

export function VoiceRecorder({ onRecordingComplete, disabled }: VoiceRecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    if (disabled) return;

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(mediaStream);

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(mediaStream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        // Stop all tracks
        mediaStream.getTracks().forEach((t) => t.stop());
        setStream(null);

        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          setRecordingState("processing");
          onRecordingComplete(blob);
        } else {
          setRecordingState("idle");
        }
      };

      recorderRef.current = recorder;
      recorder.start();
      setRecordingState("recording");
    } catch {
      setRecordingState("idle");
    }
  }, [disabled, onRecordingComplete]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    }
  }, []);

  const cancelRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      // Clear chunks so onstop produces nothing
      chunksRef.current = [];
      recorder.stop();
    }
  }, []);

  // Reset back to idle (called from parent after voice submission completes/errors)
  const resetState = useCallback(() => {
    setRecordingState("idle");
  }, []);

  // Expose resetState via ref is complex; instead the parent can set disabled=true then false.
  // But we also need to reset after processing; let's do it simply: if disabled changes from true
  // to false while in "processing", reset. Actually, the simplest approach: reset on the next
  // successful recording complete. The parent transitions to processing view anyway.

  const stateLabel: Record<RecordingState, string> = {
    idle: "Hold to speak",
    recording: "Recording...",
    processing: "Processing...",
  };

  const isRecording = recordingState === "recording";

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {/* Mic button */}
      <div className="relative flex items-center justify-center">
        {/* Pulsing glow ring behind button */}
        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{
                scale: [1.0, 1.15, 1.0],
                opacity: [0.3, 0.5, 0.3],
              }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{
                scale: { duration: 2, ease: "easeInOut", repeat: Infinity },
                opacity: { duration: 2, ease: "easeInOut", repeat: Infinity },
              }}
              className="absolute h-20 w-20 rounded-full sm:h-[96px] sm:w-[96px]"
              style={{
                background:
                  "radial-gradient(circle, rgba(212,165,116,0.4) 0%, rgba(212,165,116,0) 70%)",
              }}
            />
          )}
        </AnimatePresence>

        <motion.button
          type="button"
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onMouseLeave={isRecording ? cancelRecording : undefined}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          onTouchCancel={cancelRecording}
          disabled={disabled || recordingState === "processing"}
          whileTap={{ scale: 0.95 }}
          className={`
            relative z-10 flex items-center justify-center rounded-full
            transition-all duration-300 select-none
            h-14 w-14 sm:h-20 sm:w-20
            ${
              isRecording
                ? "bg-gradient-to-br from-[#d4a574] to-[#b8865a] shadow-[0_0_40px_rgba(212,165,116,0.5)]"
                : "border-2 border-[#d4a574]/60 bg-transparent"
            }
            ${
              disabled || recordingState === "processing"
                ? "cursor-not-allowed opacity-40"
                : "cursor-pointer"
            }
          `}
          aria-label={isRecording ? "Release to stop recording" : "Hold to start recording"}
        >
          {/* Idle pulse glow */}
          {!isRecording && recordingState === "idle" && !disabled && (
            <motion.div
              animate={{
                boxShadow: [
                  "0 0 15px rgba(212,165,116,0.1)",
                  "0 0 25px rgba(212,165,116,0.3)",
                  "0 0 15px rgba(212,165,116,0.1)",
                ],
              }}
              transition={{ duration: 3, ease: "easeInOut", repeat: Infinity }}
              className="absolute inset-0 rounded-full"
            />
          )}

          <Mic
            className={`h-6 w-6 sm:h-7 sm:w-7 transition-colors duration-200 ${
              isRecording ? "text-white" : "text-[#d4a574]"
            }`}
          />
        </motion.button>
      </div>

      {/* Waveform visualizer */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 60 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="w-full overflow-hidden"
          >
            <WaveformVisualizer stream={stream} isRecording={isRecording} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* State label */}
      <motion.p
        key={recordingState}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-sm tracking-wide text-[var(--text-muted)]"
      >
        {stateLabel[recordingState]}
      </motion.p>
    </div>
  );
}
