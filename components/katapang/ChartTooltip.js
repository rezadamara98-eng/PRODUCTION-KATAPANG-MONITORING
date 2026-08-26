"use client";

import { useState } from "react";

// Minimal hover-tooltip primitive shared by the SVG charts on this tab.
// Position is tracked relative to the chart's own wrapper (not the viewport),
// so it works correctly regardless of scroll position.
export function useChartTooltip() {
  const [tip, setTip] = useState(null); // { x, y, title, value } | null

  function showTip(evt, title, value) {
    const rect = evt.currentTarget.closest("[data-tip-root]").getBoundingClientRect();
    setTip({
      x: evt.clientX - rect.left + 12,
      y: evt.clientY - rect.top - 10,
      title,
      value,
    });
  }
  function hideTip() {
    setTip(null);
  }
  return { tip, showTip, hideTip };
}

export function ChartTooltip({ tip }) {
  if (!tip) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: tip.x,
        top: tip.y,
        pointerEvents: "none",
        zIndex: 20,
        background: "#060707",
        border: "1px solid #2dd4bf",
        borderRadius: 3,
        padding: "7px 10px",
        fontFamily: "IBM Plex Mono, monospace",
        fontSize: 11,
        color: "#eef3f5",
        boxShadow: "0 6px 18px rgba(0,0,0,.5)",
        whiteSpace: "nowrap",
      }}
    >
      <div style={{ color: "#57616b", fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".05em" }}>
        {tip.title}
      </div>
      {tip.value}
    </div>
  );
}
