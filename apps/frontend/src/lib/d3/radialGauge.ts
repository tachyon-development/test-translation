import * as d3 from "d3";

export interface DepartmentLoad {
  name: string;
  active: number;
  capacity: number;
}

const DEPT_COLORS: Record<string, string> = {
  maintenance: "#c17767",
  housekeeping: "#7c9885",
  concierge: "#6b8cae",
  "front-desk": "#c9a84c",
  kitchen: "#8a7fb5",
};

function loadColor(ratio: number): string {
  if (ratio > 0.8) return "#c17767"; // coral / overloaded
  if (ratio > 0.5) return "#c9a84c"; // yellow / busy
  return "#7c9885"; // sage / low
}

export function renderRadialGauge(
  svgEl: SVGSVGElement,
  data: DepartmentLoad[],
  dimensions: { width: number; height: number }
) {
  const { width, height } = dimensions;
  const svg = d3.select(svgEl);
  svg.attr("width", width).attr("height", height);

  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = Math.min(cx, cy) - 10;
  const ringWidth = Math.max(10, maxRadius / (data.length + 1) - 4);
  const gap = 4;

  let g = svg.select<SVGGElement>("g.gauge-root");
  if (g.empty()) {
    g = svg.append("g").attr("class", "gauge-root");
  }
  g.attr("transform", `translate(${cx},${cy})`);

  const totalActive = data.reduce((s, d) => s + d.active, 0);

  // Background rings
  const bgArcs = g.selectAll<SVGPathElement, DepartmentLoad>("path.bg-ring").data(data, (d) => d.name);

  const arcGen = (i: number) => {
    const outerR = maxRadius - i * (ringWidth + gap);
    const innerR = outerR - ringWidth;
    return d3.arc<unknown>().innerRadius(innerR).outerRadius(outerR).startAngle(0).endAngle(Math.PI * 2);
  };

  bgArcs
    .enter()
    .append("path")
    .attr("class", "bg-ring")
    .merge(bgArcs)
    .attr("d", (_, i) => arcGen(i)({} as unknown) as string)
    .attr("fill", "rgba(255,255,255,0.04)");
  bgArcs.exit().remove();

  // Foreground rings
  const fgArcs = g.selectAll<SVGPathElement, DepartmentLoad>("path.fg-ring").data(data, (d) => d.name);

  fgArcs
    .enter()
    .append("path")
    .attr("class", "fg-ring")
    .merge(fgArcs)
    .transition()
    .duration(1000)
    .ease(d3.easeCubicInOut)
    .attrTween("d", function (d, i) {
      const outerR = maxRadius - i * (ringWidth + gap);
      const innerR = outerR - ringWidth;
      const ratio = Math.min(d.active / (d.capacity || 1), 1);
      const endAngle = ratio * Math.PI * 2;
      const arc = d3.arc<unknown>().innerRadius(innerR).outerRadius(outerR).startAngle(0);
      const prev = (this as SVGPathElement).__prevAngle ?? 0;
      const interp = d3.interpolate(prev, endAngle);
      (this as SVGPathElement).__prevAngle = endAngle;
      return (t: number) => arc.endAngle(interp(t))({} as unknown) as string;
    })
    .attr("fill", (d) => loadColor(d.active / (d.capacity || 1)));

  fgArcs.exit().remove();

  // Pulse animation for overloaded departments
  data.forEach((d, i) => {
    const ratio = d.active / (d.capacity || 1);
    if (ratio > 0.8) {
      const outerR = maxRadius - i * (ringWidth + gap);
      const innerR = outerR - ringWidth;
      let pulse = g.select<SVGCircleElement>(`circle.pulse-${i}`);
      if (pulse.empty()) {
        pulse = g.append("circle").attr("class", `pulse-${i}`);
      }
      pulse
        .attr("r", (outerR + innerR) / 2)
        .attr("fill", "none")
        .attr("stroke", "#c17767")
        .attr("stroke-width", 2)
        .attr("opacity", 0.6);

      (function loop() {
        pulse
          .transition()
          .duration(1200)
          .attr("opacity", 0)
          .attr("stroke-width", 0)
          .transition()
          .duration(0)
          .attr("opacity", 0.6)
          .attr("stroke-width", 2)
          .on("end", loop);
      })();
    }
  });

  // Center text
  let centerText = g.select<SVGTextElement>("text.center-count");
  if (centerText.empty()) {
    centerText = g
      .append("text")
      .attr("class", "center-count")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("fill", "#e8e4df")
      .attr("font-size", "28px")
      .attr("font-weight", "bold");
  }
  centerText.text(totalActive);

  let centerLabel = g.select<SVGTextElement>("text.center-label");
  if (centerLabel.empty()) {
    centerLabel = g
      .append("text")
      .attr("class", "center-label")
      .attr("text-anchor", "middle")
      .attr("y", 22)
      .attr("fill", "#9a9486")
      .attr("font-size", "11px");
  }
  centerLabel.text("active");

  // Legend
  let legend = g.select<SVGGElement>("g.legend");
  if (legend.empty()) {
    legend = g.append("g").attr("class", "legend");
  }
  legend.attr("transform", `translate(${maxRadius + 12}, ${-maxRadius + 10})`);

  const items = legend.selectAll<SVGGElement, DepartmentLoad>("g.legend-item").data(data, (d) => d.name);

  const enter = items.enter().append("g").attr("class", "legend-item");
  enter.append("rect").attr("width", 8).attr("height", 8).attr("rx", 2);
  enter
    .append("text")
    .attr("x", 12)
    .attr("dy", "0.7em")
    .attr("fill", "#9a9486")
    .attr("font-size", "10px");

  const merged = enter.merge(items);
  merged.attr("transform", (_, i) => `translate(0, ${i * 16})`);
  merged.select("rect").attr("fill", (d) => DEPT_COLORS[d.name] ?? "#666");
  merged.select("text").text((d) => `${d.name} (${d.active}/${d.capacity})`);

  items.exit().remove();
}

// Extend SVGPathElement for tracking previous angle
declare global {
  interface SVGPathElement {
    __prevAngle?: number;
  }
}

export function generateMockDepartmentData(): DepartmentLoad[] {
  return [
    { name: "maintenance", active: 3 + Math.floor(Math.random() * 8), capacity: 10 },
    { name: "housekeeping", active: 5 + Math.floor(Math.random() * 10), capacity: 15 },
    { name: "concierge", active: 2 + Math.floor(Math.random() * 5), capacity: 8 },
    { name: "front-desk", active: 3 + Math.floor(Math.random() * 7), capacity: 10 },
    { name: "kitchen", active: 2 + Math.floor(Math.random() * 6), capacity: 8 },
  ];
}
