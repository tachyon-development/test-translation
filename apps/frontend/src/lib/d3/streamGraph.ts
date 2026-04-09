import * as d3 from "d3";

export interface StreamDatum {
  time: Date;
  maintenance: number;
  housekeeping: number;
  concierge: number;
  "front-desk": number;
  kitchen: number;
}

const DEPARTMENTS = [
  "maintenance",
  "housekeeping",
  "concierge",
  "front-desk",
  "kitchen",
] as const;

const COLORS: Record<string, string> = {
  maintenance: "#c17767",
  housekeeping: "#7c9885",
  concierge: "#6b8cae",
  "front-desk": "#c9a84c",
  kitchen: "#8a7fb5",
};

export function renderStreamGraph(
  svgEl: SVGSVGElement,
  data: StreamDatum[],
  dimensions: { width: number; height: number }
) {
  const { width, height } = dimensions;
  const margin = { top: 20, right: 20, bottom: 30, left: 40 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = d3.select(svgEl);
  svg.attr("width", width).attr("height", height);

  // Ensure group exists
  let g = svg.select<SVGGElement>("g.stream-root");
  if (g.empty()) {
    g = svg.append("g").attr("class", "stream-root");
  }
  g.attr("transform", `translate(${margin.left},${margin.top})`);

  // Scales
  const x = d3
    .scaleTime()
    .domain(d3.extent(data, (d) => d.time) as [Date, Date])
    .range([0, innerW]);

  const stack = d3
    .stack<StreamDatum>()
    .keys(DEPARTMENTS as unknown as string[])
    .offset(d3.stackOffsetWiggle)
    .order(d3.stackOrderInsideOut);

  const series = stack(data);

  const yMax = d3.max(series, (s) => d3.max(s, (d) => d[1])) ?? 0;
  const yMin = d3.min(series, (s) => d3.min(s, (d) => d[0])) ?? 0;

  const y = d3.scaleLinear().domain([yMin, yMax]).range([innerH, 0]);

  const area = d3
    .area<d3.SeriesPoint<StreamDatum>>()
    .x((d) => x(d.data.time))
    .y0((d) => y(d[0]))
    .y1((d) => y(d[1]))
    .curve(d3.curveBasis);

  // Layers
  const layers = g.selectAll<SVGPathElement, d3.Series<StreamDatum, string>>("path.layer").data(series, (d) => d.key);

  layers
    .enter()
    .append("path")
    .attr("class", "layer")
    .attr("fill", (d) => COLORS[d.key] ?? "#666")
    .attr("opacity", 0.8)
    .attr("d", area)
    .merge(layers)
    .transition()
    .duration(1000)
    .ease(d3.easeCubicInOut)
    .attr("d", area);

  layers.exit().transition().duration(500).attr("opacity", 0).remove();

  // X axis
  let xAxisG = g.select<SVGGElement>("g.x-axis");
  if (xAxisG.empty()) {
    xAxisG = g.append("g").attr("class", "x-axis");
  }
  xAxisG
    .attr("transform", `translate(0,${innerH})`)
    .transition()
    .duration(1000)
    .call(
      d3
        .axisBottom(x)
        .ticks(6)
        .tickFormat((d) => d3.timeFormat("%H:%M")(d as Date))
    )
    .selectAll("text")
    .attr("fill", "#9a9486")
    .attr("font-size", "10px");

  xAxisG.selectAll(".domain, .tick line").attr("stroke", "rgba(255,255,255,0.05)");

  // Tooltip
  let tooltip = d3.select(svgEl.parentElement!).select<HTMLDivElement>(".stream-tooltip");
  if (tooltip.empty()) {
    tooltip = d3
      .select(svgEl.parentElement!)
      .append("div")
      .attr("class", "stream-tooltip")
      .style("position", "absolute")
      .style("pointer-events", "none")
      .style("background", "rgba(15,15,23,0.9)")
      .style("border", "1px solid rgba(255,255,255,0.1)")
      .style("border-radius", "6px")
      .style("padding", "6px 10px")
      .style("font-size", "12px")
      .style("color", "#e8e4df")
      .style("opacity", "0")
      .style("z-index", "10");
  }

  // Hover overlay
  let overlay = g.select<SVGRectElement>("rect.overlay");
  if (overlay.empty()) {
    overlay = g.append("rect").attr("class", "overlay");
  }
  overlay
    .attr("width", innerW)
    .attr("height", innerH)
    .attr("fill", "transparent")
    .on("mousemove", (event: MouseEvent) => {
      const [mx] = d3.pointer(event, g.node());
      const time = x.invert(mx);
      const bisect = d3.bisector<StreamDatum, Date>((d) => d.time).left;
      const idx = Math.min(bisect(data, time), data.length - 1);
      const datum = data[idx];
      if (!datum) return;

      const lines = DEPARTMENTS.map(
        (dept) =>
          `<span style="color:${COLORS[dept]}">\u25CF</span> ${dept}: ${datum[dept]}`
      ).join("<br/>");

      tooltip
        .html(`<strong>${d3.timeFormat("%H:%M")(datum.time)}</strong><br/>${lines}`)
        .style("left", `${event.offsetX + 12}px`)
        .style("top", `${event.offsetY - 10}px`)
        .style("opacity", "1");
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", "0");
    });
}

export function generateMockStreamData(): StreamDatum[] {
  const now = new Date();
  const points: StreamDatum[] = [];
  for (let i = 144; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 10 * 60 * 1000); // 10-min intervals, 24h
    const hour = time.getHours();
    const busy = hour >= 8 && hour <= 22 ? 1 : 0.3;
    points.push({
      time,
      maintenance: Math.round((2 + Math.random() * 5) * busy),
      housekeeping: Math.round((3 + Math.random() * 8) * busy),
      concierge: Math.round((1 + Math.random() * 4) * busy),
      "front-desk": Math.round((2 + Math.random() * 6) * busy),
      kitchen: Math.round((1 + Math.random() * 5) * busy),
    });
  }
  return points;
}
