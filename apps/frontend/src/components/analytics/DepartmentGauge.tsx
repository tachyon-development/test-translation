"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import {
  renderRadialGauge,
  generateMockDepartmentData,
  type DepartmentLoad,
} from "@/lib/d3/radialGauge";
import { apiRequest } from "@/lib/api";

export function DepartmentGauge() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<DepartmentLoad[]>([]);
  const [dims, setDims] = useState({ width: 0, height: 0 });

  const fetchData = useCallback(async () => {
    try {
      const res = await apiRequest<{ departments: DepartmentLoad[] }>(
        "/api/analytics/departments"
      );
      if (res.departments?.length) {
        setData(res.departments);
        return;
      }
    } catch {
      // API unavailable
    }
    setData(generateMockDepartmentData());
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10_000);
    return () => clearInterval(interval);
  }, [fetchData]);

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

  useEffect(() => {
    if (!svgRef.current || !data.length || dims.width === 0) return;
    renderRadialGauge(svgRef.current, data, dims);
  }, [data, dims]);

  return (
    <div className="relative rounded-xl border border-white/[0.06] bg-[var(--bg-elevated)] p-5">
      <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
        Department Load
      </h3>
      <div ref={containerRef} className="relative h-56 w-full">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted)]">
            Loading department data...
          </div>
        ) : (
          <svg ref={svgRef} className="h-full w-full" />
        )}
      </div>
    </div>
  );
}
