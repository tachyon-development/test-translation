import * as d3 from "d3";

export interface ConfidenceData {
  scores: number[];
}

const THRESHOLD = 0.7;
const COLOR_ABOVE = "#7c9885";
const COLOR_BELOW = "#c17767";

export function renderHistogram(
  svgEl: SVGSVGElement,
  data: ConfidenceData,
  dimensions: { width: number; height: number }
) {
  const { width, height } = dimensions;
  const margin = { top: 20, right: 20, bottom: 35, left: 45 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = d3.select(svgEl);
  svg.attr("width", width).attr("height", height);

  let g = svg.select<SVGGElement>("g.hist-root");
  if (g.empty()) {
    g = svg.append("g").attr("class", "hist-root");
  }
  g.attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([0.5, 1.0]).range([0, innerW]);

  const bins = d3
    .bin()
    .domain([0.5, 1.0])
    .thresholds([0.5, 0.6, 0.7, 0.8, 0.9])(data.scores);

  const yMax = d3.max(bins, (b) => b.length) ?? 1;
  const y = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0]);

  const total = data.scores.length || 1;

  // Low-confidence zone background
  let zone = g.select<SVGRectElement>("rect.low-zone");
  if (zone.empty()) {
    zone = g.append("rect").attr("class", "low-zone");
  }
  zone
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", x(THRESHOLD))
    .attr("height", innerH)
    .attr("fill", "rgba(193,119,103,0.08)");

  // Threshold line
  let threshLine = g.select<SVGLineElement>("line.threshold");
  if (threshLine.empty()) {
    threshLine = g.append("line").attr("class", "threshold");
  }
  threshLine
    .attr("x1", x(THRESHOLD))
    .attr("x2", x(THRESHOLD))
    .attr("y1", 0)
    .attr("y2", innerH)
    .attr("stroke", "#c17767")
    .attr("stroke-width", 1.5)
    .attr("stroke-dasharray", "4,4")
    .attr("opacity", 0.7);

  let threshLabel = g.select<SVGTextElement>("text.thresh-label");
  if (threshLabel.empty()) {
    threshLabel = g
      .append("text")
      .attr("class", "thresh-label")
      .attr("fill", "#c17767")
      .attr("font-size", "10px")
      .attr("text-anchor", "middle");
  }
  threshLabel.attr("x", x(THRESHOLD)).attr("y", -6).text("threshold");

  // Bars
  const bars = g.selectAll<SVGRectElement, d3.Bin<number, number>>("rect.bar").data(bins, (d) => `${d.x0}`);

  bars
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", (d) => x(d.x0 ?? 0.5) + 1)
    .attr("width", (d) => Math.max(0, x(d.x1 ?? 1) - x(d.x0 ?? 0.5) - 2))
    .attr("y", innerH)
    .attr("height", 0)
    .attr("rx", 3)
    .attr("fill", (d) => ((d.x0 ?? 0) < THRESHOLD ? COLOR_BELOW : COLOR_ABOVE))
    .attr("opacity", 0.85)
    .merge(bars)
    .transition()
    .duration(800)
    .ease(d3.easeCubicOut)
    .attr("x", (d) => x(d.x0 ?? 0.5) + 1)
    .attr("width", (d) => Math.max(0, x(d.x1 ?? 1) - x(d.x0 ?? 0.5) - 2))
    .attr("y", (d) => y(d.length))
    .attr("height", (d) => innerH - y(d.length))
    .attr("fill", (d) => ((d.x0 ?? 0) < THRESHOLD ? COLOR_BELOW : COLOR_ABOVE));

  bars.exit().transition().duration(300).attr("height", 0).attr("y", innerH).remove();

  // X axis
  let xAxisG = g.select<SVGGElement>("g.x-axis");
  if (xAxisG.empty()) {
    xAxisG = g.append("g").attr("class", "x-axis");
  }
  xAxisG
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format(".1f")))
    .selectAll("text")
    .attr("fill", "#9a9486")
    .attr("font-size", "10px");
  xAxisG.selectAll(".domain, .tick line").attr("stroke", "rgba(255,255,255,0.05)");

  // Y axis
  let yAxisG = g.select<SVGGElement>("g.y-axis");
  if (yAxisG.empty()) {
    yAxisG = g.append("g").attr("class", "y-axis");
  }
  yAxisG
    .call(d3.axisLeft(y).ticks(5))
    .selectAll("text")
    .attr("fill", "#9a9486")
    .attr("font-size", "10px");
  yAxisG.selectAll(".domain, .tick line").attr("stroke", "rgba(255,255,255,0.05)");

  // Tooltip
  let tooltip = d3.select(svgEl.parentElement!).select<HTMLDivElement>(".hist-tooltip");
  if (tooltip.empty()) {
    tooltip = d3
      .select(svgEl.parentElement!)
      .append("div")
      .attr("class", "hist-tooltip")
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

  g.selectAll<SVGRectElement, d3.Bin<number, number>>("rect.bar")
    .on("mouseenter", function (event: MouseEvent, d) {
      d3.select(this).attr("opacity", 1);
      const pct = ((d.length / total) * 100).toFixed(1);
      tooltip
        .html(`<strong>${d3.format(".1f")(d.x0 ?? 0)} - ${d3.format(".1f")(d.x1 ?? 0)}</strong><br/>Count: ${d.length}<br/>${pct}%`)
        .style("left", `${event.offsetX + 12}px`)
        .style("top", `${event.offsetY - 10}px`)
        .style("opacity", "1");
    })
    .on("mouseleave", function () {
      d3.select(this).attr("opacity", 0.85);
      tooltip.style("opacity", "0");
    });
}

export function generateMockConfidenceData(): ConfidenceData {
  const scores: number[] = [];
  for (let i = 0; i < 200; i++) {
    // Skew towards higher confidence
    const raw = 0.5 + Math.random() * 0.5;
    const skewed = 0.5 + (raw - 0.5) * (0.6 + Math.random() * 0.8);
    scores.push(Math.min(1, Math.max(0.5, skewed)));
  }
  return { scores };
}
