"use client";

import { useRef, useEffect, useCallback } from "react";

interface WaveformVisualizerProps {
  stream: MediaStream | null;
  isRecording: boolean;
}

const BAR_WIDTH = 3;
const BAR_GAP = 2;
const COLOR = "#d4a574";
const FFT_SIZE = 256;

export function WaveformVisualizer({ stream, isRecording }: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const totalBarWidth = BAR_WIDTH + BAR_GAP;
    const barCount = Math.floor(width / totalBarWidth);
    const startIndex = 0;
    const step = Math.max(1, Math.floor(dataArray.length / barCount));

    const centerY = height / 2;

    for (let i = 0; i < barCount; i++) {
      const dataIndex = startIndex + i * step;
      const value = dataArray[dataIndex] ?? 0;
      const normalised = value / 255;

      const barHeight = Math.max(2, normalised * (height * 0.85));
      const opacity = 0.25 + normalised * 0.75;

      ctx.fillStyle = `rgba(212, 165, 116, ${opacity})`;

      const x = i * totalBarWidth;
      const y = centerY - barHeight / 2;

      ctx.beginPath();
      ctx.roundRect(x, y, BAR_WIDTH, barHeight, BAR_WIDTH / 2);
      ctx.fill();
    }

    rafRef.current = requestAnimationFrame(draw);
  }, []);

  // Setup / teardown audio context and animation loop
  useEffect(() => {
    if (!isRecording || !stream) {
      // Stop drawing
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      // Cleanup audio nodes
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      analyserRef.current = null;
      return;
    }

    // Create audio context and analyser
    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.8;

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    audioCtxRef.current = audioCtx;
    analyserRef.current = analyser;
    sourceRef.current = source;

    // Start draw loop
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      source.disconnect();
      audioCtx.close().catch(() => {});
      audioCtxRef.current = null;
      analyserRef.current = null;
      sourceRef.current = null;
    };
  }, [isRecording, stream, draw]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        canvas.width = width * window.devicePixelRatio;
        canvas.height = 60 * window.devicePixelRatio;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    });

    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full"
      style={{ height: 60 }}
      aria-hidden="true"
    />
  );
}
