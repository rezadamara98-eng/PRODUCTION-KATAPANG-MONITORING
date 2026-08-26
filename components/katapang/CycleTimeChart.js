"use client";

import { useChartTooltip, ChartTooltip } from "./ChartTooltip";

// Vertical bar per station/operator, with a dashed takt-time reference line.
// Any bar taller than takt time is the bottleneck and renders in the
// "critical" status color instead of the normal accent.
export default function CycleTimeChart({ data, taktTime }) {
  const { tip, showTip, hideTip } = useChartTooltip();

  const w = 640;
  const h = 260;
  const padL = 46;
  const padR = 14;
  const padT = 18;
  const padB = 46;

  const maxV = Math.max(taktTime, ...data.map((d) => d.cycleTime)) * 1.15;
  const yScale = (v) => h - padB - (v / maxV) * (h - padT - padB);
  const colW = (w - padL - padR) / data.length;
  const barW = colW * 0.5;

  const step = niceStep(maxV);
  const gridVals = [];
  for (let v = step; v < maxV; v += step) gridVals.push(Math.round(v));

  function niceStep(max) {
    const raw = max / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const nice = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
    return nice * mag;
  }

  const taktY = yScale(taktTime);

  return (
    <div data-tip-root style={{ position: "relative" }}>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block", padding: "12px 4px 4px" }}>
        {gridVals.map((v) => (
          <g key={v}>
            <line x1={padL} y1={yScale(v)} x2={w - padR} y2={yScale(v)} stroke="#1c2329" strokeWidth="1" />
            <text x={padL - 8} y={yScale(v) + 3} textAnchor="end" fontFamily="IBM Plex Mono" fontSize="9" fill="#57616b">
              {v}
            </text>
          </g>
        ))}
        <line x1={padL} y1={taktY} x2={w - padR} y2={taktY} stroke="#fab219" strokeWidth="1.5" strokeDasharray="5 3" />
        <text x={w - padR} y={taktY - 6} textAnchor="end" fontFamily="IBM Plex Mono" fontSize="9.5" fill="#fab219">
          takt {taktTime}s
        </text>

        {data.map((d, i) => {
          const cx = padL + i * colW + colW / 2;
          const y = yScale(d.cycleTime);
          const isBottleneck = d.cycleTime > taktTime;
          const color = isBottleneck ? "#d03b3b" : "#2dd4bf";
          return (
            <g key={d.station}>
              <rect
                x={cx - barW / 2}
                y={y}
                width={barW}
                height={h - padB - y}
                fill={color}
                rx="2"
                style={{ cursor: "pointer" }}
                onMouseMove={(e) => showTip(e, `${d.station} · ${d.operator}`, `${d.cycleTime} detik${isBottleneck ? " — bottleneck" : ""}`)}
                onMouseLeave={hideTip}
              />
              <text x={cx} y={h - padB + 15} textAnchor="middle" fontFamily="IBM Plex Sans" fontSize="9.5" fill="#8b98a3">
                {d.station}
              </text>
              <text x={cx} y={h - padB + 27} textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="8.5" fill="#57616b">
                {d.operator}
              </text>
            </g>
          );
        })}
      </svg>
      <ChartTooltip tip={tip} />
    </div>
  );
}
