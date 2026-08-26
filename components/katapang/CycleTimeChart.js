"use client";

import { useChartTooltip, ChartTooltip } from "./ChartTooltip";

// Vertical bar per station (a group of one or more operators sharing the
// same No. Proses), with a dashed takt-time reference line. `isOverTakt(g)`
// decides bottleneck coloring - passed in so the caller's own bottleneck
// logic (which also accounts for a target takt time) stays the single
// source of truth instead of being re-derived here.
export default function CycleTimeChart({ groups, taktTime, isOverTakt }) {
  const { tip, showTip, hideTip } = useChartTooltip();

  const h = 260;
  const padL = 46;
  const padR = 14;
  const padT = 18;
  const padB = 46;
  const w = Math.max(640, groups.length * 62);

  const maxV = Math.max(taktTime, ...groups.map((g) => g.effectiveCT)) * 1.15;
  const yScale = (v) => h - padB - (v / maxV) * (h - padT - padB);
  const colW = (w - padL - padR) / groups.length;
  const barW = Math.min(colW * 0.5, 56);

  const step = niceStep(maxV);
  const gridVals = [];
  for (let v = step; v < maxV; v += step) gridVals.push(Math.round(v));

  function niceStep(max) {
    const raw = max / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const norm = raw / mag;
    const nice = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
    return nice * mag;
  }

  const taktY = yScale(taktTime);

  return (
    <div data-tip-root style={{ position: "relative", overflowX: "auto" }}>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block", padding: "12px 4px 4px", minWidth: w }}>
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
          takt {taktTime.toFixed(1)}s
        </text>

        {groups.map((g, i) => {
          const cx = padL + i * colW + colW / 2;
          const y = yScale(g.effectiveCT);
          const isBottleneck = isOverTakt(g);
          const color = isBottleneck ? "#d03b3b" : "#2dd4bf";
          const prosesLabel = g.proses.length > 10 ? g.proses.slice(0, 9) + "…" : g.proses;
          return (
            <g key={g.key}>
              <rect
                x={cx - barW / 2}
                y={y}
                width={barW}
                height={h - padB - y}
                fill={color}
                rx="2"
                style={{ cursor: "pointer" }}
                onMouseMove={(e) =>
                  showTip(
                    e,
                    `${g.noProses} · ${g.proses}`,
                    `${g.effectiveCT.toFixed(1)} detik efektif · ${g.operatorCount} operator (${g.operatorNames.join(", ")})${isBottleneck ? " — bottleneck" : ""}`
                  )
                }
                onMouseLeave={hideTip}
              />
              <text x={cx} y={h - padB + 15} textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9.5" fill="#8b98a3">
                {g.noProses}
              </text>
              <text x={cx} y={h - padB + 27} textAnchor="middle" fontFamily="IBM Plex Sans" fontSize="8.5" fill="#57616b">
                {prosesLabel}
              </text>
            </g>
          );
        })}
      </svg>
      <ChartTooltip tip={tip} />
    </div>
  );
}
