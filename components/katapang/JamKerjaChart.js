"use client";

import { useChartTooltip, ChartTooltip } from "./ChartTooltip";

const DEP_COLOR = {
  Supply: "#3987e5",
  Sewing: "#d95926",
  "Gudang Jadi": "#199e70",
  Support: "#d55181",
};

// Grouped bar: SM (target, dashed ghost outline) vs Aktual (solid, colored
// by department) per department. A department with no SM value gets a
// visible "N/A" marker instead of a silently-zero ghost bar.
export default function JamKerjaChart({ data }) {
  const { tip, showTip, hideTip } = useChartTooltip();

  const w = 560;
  const h = 250;
  const padL = 44;
  const padR = 14;
  const padT = 14;
  const padB = 34;

  const maxV = Math.max(1, ...data.flatMap((d) => [d.sm || 0, d.aktual || 0])) * 1.08;
  const yScale = (v) => h - padB - (v / maxV) * (h - padT - padB);
  const groupW = (w - padL - padR) / data.length;

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

  return (
    <div data-tip-root style={{ position: "relative" }}>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block", padding: "12px 4px 4px" }}>
        {gridVals.map((v) => {
          const y = yScale(v);
          return (
            <g key={v}>
              <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#1c2329" strokeWidth="1" />
              <text x={padL - 8} y={y + 3} textAnchor="end" fontFamily="IBM Plex Mono" fontSize="9" fill="#57616b">
                {v}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const gx = padL + i * groupW;
          const barW = groupW * 0.28;
          const gap = groupW * 0.08;
          const smX = gx + groupW * 0.18;
          const akX = smX + barW + gap;
          const color = DEP_COLOR[d.name] || "#8b98a3";
          const hasSm = d.sm !== null && d.sm !== undefined;
          const ay = yScale(d.aktual || 0);

          return (
            <g key={d.name}>
              {hasSm ? (
                <rect
                  x={smX}
                  y={yScale(d.sm)}
                  width={barW}
                  height={h - padB - yScale(d.sm)}
                  fill="none"
                  stroke="#57616b"
                  strokeDasharray="3 2"
                  strokeWidth="1.5"
                  rx="2"
                  style={{ cursor: "pointer" }}
                  onMouseMove={(e) => showTip(e, `${d.name} · SM`, `${d.sm.toLocaleString("id-ID")} menit`)}
                  onMouseLeave={hideTip}
                />
              ) : (
                <text x={smX + barW / 2} y={h - padB + 15} textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="8" fill="#4a535d">
                  N/A
                </text>
              )}
              <rect
                x={akX}
                y={ay}
                width={barW}
                height={h - padB - ay}
                fill={color}
                rx="2"
                style={{ cursor: "pointer" }}
                onMouseMove={(e) => showTip(e, `${d.name} · Aktual`, `${(d.aktual || 0).toLocaleString("id-ID")} menit`)}
                onMouseLeave={hideTip}
              />
              <text x={gx + groupW / 2} y={h - padB + 27} textAnchor="middle" fontFamily="IBM Plex Sans" fontSize="10.5" fill="#8b98a3">
                {d.name}
              </text>
            </g>
          );
        })}
      </svg>
      <ChartTooltip tip={tip} />
    </div>
  );
}
