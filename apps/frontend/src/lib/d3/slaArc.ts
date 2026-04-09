import * as d3 from "d3";

function slaColor(pct: number): string {
  if (pct >= 95) return "#7c9885"; // sage
  if (pct >= 85) return "#c9a84c"; // yellow
  return "#c17767"; // coral
}

export function renderSLAArc(
  svgEl: SVGSVGElement,
  percentage: number,
  dimensions: { width: number; height: number }
) {
  const { width, height } = dimensions;
  const svg = d3.select(svgEl);
  svg.attr("width", width).attr("height", height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(cx, cy) - 12;
  const arcWidth = Math.max(12, radius * 0.18);

  let g = svg.select<SVGGElement>("g.sla-root");
  if (g.empty()) {
    g = svg.append("g").attr("class", "sla-root");
  }
  g.attr("transform", `translate(${cx},${cy})`);

  const tau = 2 * Math.PI;

  const arcGen = d3
    .arc<{ endAngle: number }>()
    .innerRadius(radius - arcWidth)
    .outerRadius(radius)
    .startAngle(0)
    .cornerRadius(arcWidth / 2);

  // Background ring
  let bgRing = g.select<SVGPathElement>("path.bg-ring");
  if (bgRing.empty()) {
    bgRing = g.append("path").attr("class", "bg-ring");
  }
  bgRing.attr("d", arcGen({ endAngle: tau })!).attr("fill", "rgba(255,255,255,0.04)");

  // Foreground arc
  let fgRing = g.select<SVGPathElement>("path.fg-ring");
  const endAngle = (percentage / 100) * tau;
  const color = slaColor(percentage);

  if (fgRing.empty()) {
    fgRing = g
      .append("path")
      .attr("class", "fg-ring")
      .attr("d", arcGen({ endAngle: 0 })!);

    // Animated sweep on mount
    fgRing
      .transition()
      .duration(1500)
      .ease(d3.easeCubicInOut)
      .attrTween("d", function () {
        const interp = d3.interpolate(0, endAngle);
        return (t: number) => arcGen({ endAngle: interp(t) })!;
      })
      .attr("fill", color);
  } else {
    fgRing
      .transition()
      .duration(1000)
      .ease(d3.easeCubicInOut)
      .attrTween("d", function () {
        const prev = (this as SVGPathElement).__prevSlaAngle ?? 0;
        const interp = d3.interpolate(prev, endAngle);
        (this as SVGPathElement).__prevSlaAngle = endAngle;
        return (t: number) => arcGen({ endAngle: interp(t) })!;
      })
      .attr("fill", color);
  }

  (fgRing.node() as SVGPathElement).__prevSlaAngle = endAngle;

  // Center percentage text
  let pctText = g.select<SVGTextElement>("text.pct-value");
  if (pctText.empty()) {
    pctText = g
      .append("text")
      .attr("class", "pct-value")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("fill", "#e8e4df")
      .attr("font-size", "32px")
      .attr("font-weight", "bold")
      .attr("dy", "-6");
  }
  pctText.text(`${percentage.toFixed(1)}%`).attr("fill", color);

  let pctLabel = g.select<SVGTextElement>("text.pct-label");
  if (pctLabel.empty()) {
    pctLabel = g
      .append("text")
      .attr("class", "pct-label")
      .attr("text-anchor", "middle")
      .attr("fill", "#9a9486")
      .attr("font-size", "11px")
      .attr("dy", "16");
  }
  pctLabel.text("SLA compliance");
}

// Extend SVGPathElement for tracking
declare global {
  interface SVGPathElement {
    __prevSlaAngle?: number;
  }
}
