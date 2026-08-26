"use client";

// Panel chrome for the industrial HUD theme - deliberately separate from the
// shared <Panel> component (used by the other tabs) so this reskin stays
// scoped to Katapang Monitoring only.
export default function HudPanel({ title, tag, tagTone = "good", children, bodyStyle }) {
  return (
    <div className="k-panel">
      <div className="k-panel-head">
        <h3>{title}</h3>
        {tag && <span className={`k-tag k-tag-${tagTone}`}>{tag}</span>}
      </div>
      <div className="k-panel-body" style={bodyStyle}>
        {children}
      </div>
    </div>
  );
}
