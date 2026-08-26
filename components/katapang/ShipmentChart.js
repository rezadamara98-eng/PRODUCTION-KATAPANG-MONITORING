"use client";

import { useChartTooltip, ChartTooltip } from "./ChartTooltip";

// Diverging horizontal bar - shortages (negative, red) vs shipped qty
// (positive, cyan) around a shared zero baseline. Scales to whatever
// magnitude the real data has, with a small headroom margin.
export default function ShipmentChart({ data }) {
  const { tip, showTip, hideTip } = useChartTooltip();

  const w = 620;
  const h = 46 * data.length + 60;
  const padL = 150;
  const padR = 60;
  const padT = 14;
  const padB = 30;

  const maxAbs = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  const headroom = maxAbs * 1.15;
  const min = -headroom;
  const max = headroom;

  const xScale = (v) => padL + ((v - min) / (max - min)) * (w - padL - padR);
  const x0 = xScale(0);
  const rowH = (h - padT - padB) / data.length;

  const gridVals = Array.from(new Set([-Math.round(headroom * 0.6), 0, Math.round(headroom * 0.6)]));

  function fmtK(v) {
    if (v === 0) return "0K";
    const sign = v < 0 ? "-" : "";
    return sign + Math.round(Math.abs(v) / 1000) + "K";
  }
  function fmtVal(v) {
    return (v < 0 ? "−" : "") + Math.abs(v).toLocaleString("id-ID") + " pcs";
  }

  return (
    <div data-tip-root style={{ position: "relative" }}>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block", padding: "12px 4px 4px" }}>
        {gridVals.map((v) => {
          const x = xScale(v);
          return (
            <g key={v}>
              <line x1={x} y1={padT} x2={x} y2={h - padB} stroke={v === 0 ? "#39434e" : "#1c2329"} strokeWidth="1" />
              <text x={x} y={h - padB + 16} textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9.5" fill="#57616b">
                {fmtK(v)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const y = padT + i * rowH + rowH * 0.24;
          const bh = rowH * 0.52;
          const xv = xScale(d.value);
          const bx = Math.min(x0, xv);
          const bw = Math.max(Math.abs(xv - x0), 1.5);
          const color = d.value < 0 ? "#d03b3b" : "#2dd4bf";
          const labelX = d.value < 0 ? x0 + 8 : bx + bw + 8;
          return (
            <g key={d.name}>
              <text x={padL - 12} y={y + bh / 2 + 4} textAnchor="end" fontFamily="IBM Plex Sans" fontSize="11" fill="#8b98a3">
                {d.name}
              </text>
              <rect
                x={bx}
                y={y}
                width={bw}
                height={bh}
                fill={color}
                rx="2"
                style={{ cursor: "pointer" }}
                onMouseMove={(e) => showTip(e, d.name, fmtVal(d.value))}
                onMouseLeave={hideTip}
              />
              <text x={labelX} y={y + bh / 2 + 4} textAnchor="start" fontFamily="IBM Plex Mono" fontSize="10.5" fill="#c7ced4">
                {fmtVal(d.value)}
              </text>
            </g>
          );
        })}
      </svg>
      <ChartTooltip tip={tip} />
    </div>
  );
}
