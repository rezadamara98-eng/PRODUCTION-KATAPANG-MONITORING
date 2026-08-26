"use client";

// Radial arc gauge used for Achievement Sewing / Achievement Distribusi.
// Pure SVG, no chart library - value is clamped visually at 120% so an
// over-achieving line (e.g. 100.4%) still reads inside the arc.
export default function RadialGauge({ pct, color, size = 118 }) {
  const value = Number.isFinite(pct) ? pct : 0;
  const r = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  const start = -220;
  const sweep = 260;
  const clampPct = Math.min(Math.max(value, 0), 120);

  const toRad = (a) => (a * Math.PI) / 180;
  const pt = (angleDeg, radius) => {
    const a = toRad(angleDeg);
    return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)];
  };
  const arcPath = (a0, a1, radius) => {
    const [x0, y0] = pt(a0, radius);
    const [x1, y1] = pt(a1, radius);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M ${x0} ${y0} A ${radius} ${radius} 0 ${large} 1 ${x1} ${y1}`;
  };

  const fillAngle = start + sweep * (clampPct / 120);
  const ticks = [];
  for (let i = 0; i <= 12; i++) {
    const a = start + (sweep * i) / 12;
    const [x1, y1] = pt(a, r + 1);
    const [x2, y2] = pt(a, r - 5);
    ticks.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2a323b" strokeWidth="1.5" />);
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <path d={arcPath(start, start + sweep, r)} fill="none" stroke="#1c2329" strokeWidth="9" strokeLinecap="round" />
      {ticks}
      <path
        d={arcPath(start, fillAngle, r)}
        fill="none"
        stroke={color}
        strokeWidth="9"
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 5px ${color}99)` }}
      />
      <text
        x={cx}
        y={cy + 5}
        textAnchor="middle"
        fontFamily="IBM Plex Mono, monospace"
        fontSize="19"
        fill="#eef3f5"
        fontWeight="500"
      >
        {value.toFixed(1).replace(".", ",")}%
      </text>
    </svg>
  );
}
