"use client";

export default function KpiCard({ eyebrow, value, unit, tone }) {
  const toneColor =
    tone === "green" ? "var(--green)" : tone === "red" ? "var(--red)" : "var(--teal)";
  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--steel)",
        borderTop: `3px solid ${toneColor}`,
        borderRadius: 4,
        padding: "18px 20px",
        flex: "1 1 160px",
        minWidth: 160,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 11,
          letterSpacing: "0.12em",
          color: "var(--text-faint)",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 30,
          fontWeight: 600,
          color: "var(--text)",
          lineHeight: 1,
        }}
      >
        {value}
        {unit && (
          <span style={{ fontSize: 15, color: "var(--text-muted)", marginLeft: 4 }}>{unit}</span>
        )}
      </div>
    </div>
  );
}
