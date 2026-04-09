"use client";

import { useState, useCallback } from "react";

export type ConnectionState = "connected" | "reconnecting" | "disconnected";

export function useConnectionStatus() {
  const [status, setStatus] = useState<ConnectionState>("disconnected");
  const [retryIn, setRetryIn] = useState<number | undefined>(undefined);

  const setConnected = useCallback(() => {
    setStatus("connected");
    setRetryIn(undefined);
  }, []);

  const setReconnecting = useCallback((seconds?: number) => {
    setStatus("reconnecting");
    setRetryIn(seconds);
  }, []);

  const setDisconnected = useCallback(() => {
    setStatus("disconnected");
    setRetryIn(undefined);
  }, []);

  return { status, retryIn, setConnected, setReconnecting, setDisconnected };
}
