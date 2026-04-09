"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import {
  renderStreamGraph,
  generateMockStreamData,
  type StreamDatum,
} from "@/lib/d3/streamGraph";
import { apiRequest } from "@/lib/api";

export function StreamGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<StreamDatum[]>([]);
  const [dims, setDims] = useState({ width: 0, height: 0 });

  const fetchData = useCallback(async () => {
    try {
      const res = await apiRequest<{ data: StreamDatum[] }>(
        "/api/analytics/stream"
      );
      if (res.data?.length) {
        setData(
          res.data.map((d) => ({ ...d, time: new Date(d.time) }))
        );
        return;
      }
    } catch {
      // API unavailable — use mock
    }
    setData(generateMockStreamData());
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Render D3
  useEffect(() => {
    if (!svgRef.current || !data.length || dims.width === 0) return;
    renderStreamGraph(svgRef.current, data, dims);
  }, [data, dims]);

  return (
    <div className="relative rounded-xl border border-white/[0.06] bg-[var(--bg-elevated)] p-5">
      <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
        Request Volume (24h)
      </h3>
      <div ref={containerRef} className="relative h-56 w-full">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted)]">
            Loading stream data...
          </div>
        ) : (
          <svg ref={svgRef} className="h-full w-full" />
        )}
      </div>
    </div>
  );
}
