"use client";

// A single KPI readout tile. When `value` is null/undefined the tile renders
// a clearly-muted "NO DATA" state instead of a misleading "0" - a 0.00 PA
// reading and "no data yet today" are very different situations on a
// factory floor and should never look identical.
export default function KpiTile({ label, value, unit, hasData = true, foot }) {
  return (
    <div className={`k-kpi ${hasData ? "" : "k-kpi-dim"}`}>
      <span className="k-kpi-bl" />
      <span className="k-kpi-br" />
      <div className="k-kpi-head">
        <span className="k-kpi-label">{label}</span>
        <span className={`k-kpi-led ${hasData ? "k-led-on" : "k-led-off"}`} />
      </div>
      {hasData ? (
        <div className="k-kpi-value">
          {value}
          {unit && <span className="k-kpi-unit">{unit}</span>}
        </div>
      ) : (
        <div className="k-kpi-value k-kpi-muted">NO DATA</div>
      )}
      <div className="k-kpi-foot">{foot}</div>
    </div>
  );
}
