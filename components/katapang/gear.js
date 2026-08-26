"use client";

// Procedural gear silhouette generator - shared by every decorative/status
// gear used on the Katapang Monitoring HUD (brand mark, background texture,
// footer stamp, section watermark). Square-tooth profile, same approach as
// classic flat "settings" gear icons.
export function gearPathD(teeth, rOuter, rBase) {
  const slot = (Math.PI * 2) / teeth;
  let d = "";
  for (let i = 0; i < teeth; i++) {
    const a0 = i * slot;
    const a1 = a0 + slot * 0.5;
    const a2 = a0 + slot;
    const P = (r, a) => [(r * Math.cos(a)).toFixed(2), (r * Math.sin(a)).toFixed(2)];
    const p0 = P(rBase, a0);
    const p1 = P(rBase, a1);
    const p2 = P(rOuter, a1);
    const p3 = P(rOuter, a2);
    d += (i === 0 ? `M ${p0[0]} ${p0[1]} ` : `L ${p0[0]} ${p0[1]} `);
    d += `L ${p1[0]} ${p1[1]} L ${p2[0]} ${p2[1]} L ${p3[0]} ${p3[1]} `;
  }
  return d + "Z";
}

/**
 * A single gear glyph.
 * mode: "stroke" (outline, for large decorative/background gears) or
 *       "fill" (solid, for small status/emblem gears).
 * spin: null | "cw" | "ccw" - continuous rotation (respects prefers-reduced-motion
 *       via the .gear-cw/.gear-ccw classes defined once in KatapangMonitoring's
 *       scoped stylesheet).
 */
export default function Gear({
  teeth = 10,
  rOuter = 10,
  rBase = 8.4,
  rBore = 2.4,
  mode = "fill",
  color = "#2dd4bf",
  boreColor = "#0a0d10",
  strokeWidth = 2,
  opacity = 1,
  spin = null,
  duration = 8,
  style,
}) {
  const size = rOuter * 2 + strokeWidth * 2 + 2;
  const c = size / 2;
  const d = gearPathD(teeth, rOuter, rBase);
  const spinClass = spin === "cw" ? "gear-cw" : spin === "ccw" ? "gear-ccw" : "";
  const bodyProps =
    mode === "fill"
      ? { fill: color, stroke: "none" }
      : { fill: "none", stroke: color, strokeWidth };
  const boreProps =
    mode === "fill"
      ? { fill: boreColor, stroke: "none" }
      : { fill: "none", stroke: color, strokeWidth: strokeWidth * 0.7 };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ opacity, ...style }}>
      <g
        className={spinClass}
        style={spin ? { animationDuration: `${duration}s` } : undefined}
        transform={`translate(${c},${c})`}
      >
        <path d={d} {...bodyProps} />
        <circle r={rBore} {...boreProps} />
      </g>
    </svg>
  );
}
