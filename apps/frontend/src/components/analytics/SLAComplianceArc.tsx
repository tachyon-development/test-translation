"use client";

import { useRef, useEffect, useState } from "react";
import { renderSLAArc } from "@/lib/d3/slaArc";

interface SLAComplianceArcProps {
  percentage: number;
}

export function SLAComplianceArc({ percentage }: SLAComplianceArcProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });

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
    if (!svgRef.current || dims.width === 0) return;
    renderSLAArc(svgRef.current, percentage, dims);
  }, [percentage, dims]);

  return (
    <div ref={containerRef} className="relative h-56 w-full">
      <svg ref={svgRef} className="h-full w-full" />
    </div>
  );
}
