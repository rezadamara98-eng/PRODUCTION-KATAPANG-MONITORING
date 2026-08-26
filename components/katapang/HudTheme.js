"use client";

// Shared HUD theme stylesheet for the industrial/futuristic dashboard tabs
// (Katapang Monitoring + Line Balancing). Every rule below is registered
// via styled-jsx global (class-name scoped, not touching globals.css) so
// the light-navy tabs (DashboardProduction, GloveTracking, CapacityPlanner,
// AsikSolution) remain completely unaffected.
// Scoped stylesheet (Next.js styled-jsx) - everything here is namespaced
// under .k-root so the other tabs (which use the shared light-navy theme in
// globals.css / Panel.js / KpiCard.js) are completely unaffected.
export default function HudTheme() {
  return (
    <style jsx>{`
      :global(.k-root) {
        position: relative;
        overflow: hidden;
        border-radius: 4px;
        background: #0a0d10;
        background-image: radial-gradient(1200px 700px at 12% -10%, rgba(45, 212, 191, 0.06), transparent 60%),
          radial-gradient(900px 600px at 100% 0%, rgba(217, 89, 38, 0.05), transparent 55%);
        padding: 18px 18px 26px;
        color: #eef3f5;
        font-family: "IBM Plex Sans", sans-serif;
      }
      :global(.k-scanlines) {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 1;
        opacity: 0.35;
        background: repeating-linear-gradient(
          to bottom,
          rgba(255, 255, 255, 0.018) 0px,
          rgba(255, 255, 255, 0.018) 1px,
          transparent 1px,
          transparent 3px
        );
        mix-blend-mode: overlay;
      }
      :global(.k-bg-gears) {
        position: absolute;
        inset: 0;
        z-index: 1;
        overflow: hidden;
        pointer-events: none;
      }

      :global(.gear-cw),
      :global(.gear-ccw) {
        transform-box: fill-box;
        transform-origin: center;
      }
      @media (prefers-reduced-motion: no-preference) {
        :global(.gear-cw) {
          animation-name: k-spin-cw;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        :global(.gear-ccw) {
          animation-name: k-spin-ccw;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
      }
      @keyframes k-spin-cw {
        to {
          transform: rotate(360deg);
        }
      }
      @keyframes k-spin-ccw {
        to {
          transform: rotate(-360deg);
        }
      }

      :global(.k-topbar) {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        row-gap: 8px;
        padding: 12px 18px;
        margin-bottom: 14px;
        background: linear-gradient(180deg, #171d24, #12161b);
        border: 1px solid #262e37;
        border-radius: 4px;
        position: relative;
        overflow: hidden;
      }
      @media (max-width: 560px) {
        :global(.k-sys-status) {
          width: 100%;
          justify-content: space-between;
        }
      }
      :global(.k-brand) {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }
      :global(.k-brand-mark) {
        width: 34px;
        height: 34px;
        border: 1px solid #2dd4bf;
        border-radius: 3px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #2dd4bf;
        font-family: "Rajdhani", sans-serif;
        font-weight: 700;
        font-size: 15px;
        flex: none;
        box-shadow: 0 0 14px rgba(45, 212, 191, 0.35) inset;
      }
      :global(.k-brand-gears) {
        width: 34px;
        height: 30px;
        flex: none;
      }
      :global(.k-brand-text) {
        min-width: 0;
      }
      :global(.k-t2) {
        font-family: "IBM Plex Mono", monospace;
        font-size: 10.5px;
        color: #57616b;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        margin-top: 2px;
      }
      :global(.k-sys-status) {
        display: flex;
        align-items: center;
        gap: 22px;
        font-family: "IBM Plex Mono", monospace;
        font-size: 11.5px;
        color: #8b98a3;
        flex: none;
      }
      :global(.k-dot-live) {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #0ca30c;
        display: inline-block;
        box-shadow: 0 0 8px #0ca30c;
        margin-right: 7px;
      }
      @media (prefers-reduced-motion: no-preference) {
        :global(.k-dot-live) {
          animation: k-pulse 2.4s ease-in-out infinite;
        }
      }
      @keyframes k-pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.45;
        }
      }

      :global(.k-marquee-track) {
        display: flex;
        width: max-content;
        will-change: transform;
        animation-name: k-marquee-scroll;
        animation-timing-function: linear;
        animation-iteration-count: infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        :global(.k-marquee-track) {
          animation: none;
        }
      }
      @keyframes k-marquee-scroll {
        from {
          transform: translateX(0);
        }
        to {
          transform: translateX(-50%);
        }
      }
      :global(.k-marquee-item) {
        font-family: "Rajdhani", sans-serif;
        font-weight: 700;
        font-size: 18px;
        color: #eef3f5;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        white-space: nowrap;
        padding-right: 28px;
      }
      :global(.k-marquee-sep) {
        color: #2dd4bf;
        padding: 0 10px;
        font-weight: 500;
      }

      :global(.k-error) {
        background: rgba(208, 59, 59, 0.12);
        border: 1px solid #d03b3b;
        color: #eef3f5;
        padding: 12px 16px;
        margin-bottom: 16px;
        font-size: 13px;
        border-radius: 3px;
      }
      :global(.k-error strong) {
        color: #ff8080;
      }

      :global(.k-section-title) {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 14px;
        margin: 22px 0 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid #1d242b;
      }
      :global(.k-section-title-wrap) {
        position: relative;
        overflow: hidden;
      }
      :global(.k-section-gear) {
        position: absolute;
        right: -18px;
        top: -46px;
        pointer-events: none;
      }
      :global(.k-section-title h2) {
        margin: 0;
        font-family: "Rajdhani", sans-serif;
        font-weight: 600;
        font-size: 14px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #8b98a3;
        position: relative;
        z-index: 1;
      }
      :global(.k-sub) {
        font-family: "IBM Plex Mono", monospace;
        font-size: 11px;
        color: #57616b;
        position: relative;
        z-index: 1;
        white-space: nowrap;
      }

      :global(.k-kpi-grid) {
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        gap: 10px;
      }
      @media (max-width: 1180px) {
        :global(.k-kpi-grid) {
          grid-template-columns: repeat(4, 1fr);
        }
      }
      @media (max-width: 640px) {
        :global(.k-kpi-grid) {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      :global(.k-kpi) {
        position: relative;
        background: #12161b;
        border: 1px solid #262e37;
        border-radius: 3px;
        padding: 14px 14px 12px;
        min-height: 108px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      :global(.k-kpi-bl),
      :global(.k-kpi-br),
      :global(.k-kpi::before),
      :global(.k-kpi::after) {
        content: "";
        position: absolute;
        width: 9px;
        height: 9px;
        opacity: 0.55;
      }
      :global(.k-kpi::before) {
        top: 0;
        left: 0;
        border-top: 1.5px solid #2dd4bf;
        border-left: 1.5px solid #2dd4bf;
      }
      :global(.k-kpi::after) {
        top: 0;
        right: 0;
        border-top: 1.5px solid #2dd4bf;
        border-right: 1.5px solid #2dd4bf;
      }
      :global(.k-kpi-bl) {
        bottom: 0;
        left: 0;
        border-bottom: 1.5px solid #2dd4bf;
        border-left: 1.5px solid #2dd4bf;
      }
      :global(.k-kpi-br) {
        bottom: 0;
        right: 0;
        border-bottom: 1.5px solid #2dd4bf;
        border-right: 1.5px solid #2dd4bf;
      }
      :global(.k-kpi-dim::before),
      :global(.k-kpi-dim::after),
      :global(.k-kpi-dim .k-kpi-bl),
      :global(.k-kpi-dim .k-kpi-br) {
        border-color: #57616b;
        opacity: 0.3;
      }
      :global(.k-kpi-head) {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      :global(.k-kpi-label) {
        font-weight: 500;
        font-size: 10.5px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #8b98a3;
      }
      :global(.k-kpi-led) {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        flex: none;
      }
      :global(.k-led-on) {
        background: #0ca30c;
        box-shadow: 0 0 6px #0ca30c;
      }
      :global(.k-led-off) {
        background: #57616b;
      }
      :global(.k-kpi-value) {
        font-family: "IBM Plex Mono", monospace;
        font-weight: 500;
        font-size: 26px;
        color: #eef3f5;
        font-variant-numeric: tabular-nums;
        line-height: 1;
      }
      :global(.k-kpi-muted) {
        color: #57616b;
        font-size: 16px;
        letter-spacing: 0.05em;
      }
      :global(.k-kpi-unit) {
        font-family: "IBM Plex Mono", monospace;
        font-size: 11px;
        color: #57616b;
        margin-left: 5px;
      }
      :global(.k-kpi-foot) {
        font-family: "IBM Plex Mono", monospace;
        font-size: 9.5px;
        color: #57616b;
        letter-spacing: 0.04em;
      }

      :global(.k-row) {
        display: grid;
        gap: 12px;
        margin-top: 22px;
      }
      :global(.k-row-three) {
        grid-template-columns: 1fr 1fr 1fr;
      }
      :global(.k-row-two) {
        grid-template-columns: 1.15fr 1fr;
      }
      @media (max-width: 980px) {
        :global(.k-row-three), :global(.k-row-two) {
          grid-template-columns: 1fr;
        }
      }

      :global(.k-panel) {
        background: #12161b;
        border: 1px solid #262e37;
        border-radius: 3px;
        overflow: hidden;
      }
      :global(.k-panel-head) {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 16px;
        background: #171d24;
        border-bottom: 1px solid #262e37;
      }
      :global(.k-panel-head h3) {
        margin: 0;
        font-family: "Rajdhani", sans-serif;
        font-weight: 600;
        font-size: 12.5px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #eef3f5;
      }
      :global(.k-tag) {
        font-family: "IBM Plex Mono", monospace;
        font-size: 9.5px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        padding: 2px 7px;
        border-radius: 2px;
        border: 1px solid currentColor;
        white-space: nowrap;
      }
      :global(.k-tag-good) {
        color: #0ca30c;
      }
      :global(.k-tag-warning) {
        color: #fab219;
      }
      :global(.k-tag-critical) {
        color: #d03b3b;
      }
      :global(.k-tag-dim) {
        color: #57616b;
      }
      :global(.k-panel-body) {
        padding: 18px 16px;
      }

      :global(.k-gauge-wrap) {
        display: flex;
        align-items: center;
        gap: 18px;
      }
      :global(.k-gauge-figures) {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      :global(.k-gauge-pct) {
        font-family: "IBM Plex Mono", monospace;
        font-size: 15px;
        color: #8b98a3;
      }
      :global(.k-gauge-target) {
        font-family: "IBM Plex Mono", monospace;
        font-size: 10.5px;
        color: #57616b;
      }

      :global(.k-absensi-body) {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      :global(.k-absensi-icon) {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: 1.5px solid #0ca30c;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #0ca30c;
        font-family: "Rajdhani", sans-serif;
        font-weight: 700;
        font-size: 13px;
        flex: none;
        box-shadow: 0 0 14px rgba(12, 163, 12, 0.25);
      }
      :global(.k-l1) {
        font-family: "Rajdhani", sans-serif;
        font-weight: 600;
        letter-spacing: 0.04em;
        font-size: 15px;
        color: #eef3f5;
      }
      :global(.k-l2) {
        font-family: "IBM Plex Mono", monospace;
        font-size: 11px;
        color: #57616b;
        margin-top: 3px;
      }
      :global(.k-absensi-list) {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      :global(.k-absensi-row) {
        display: flex;
        justify-content: space-between;
        font-family: "IBM Plex Mono", monospace;
        font-size: 12px;
        color: #c7ced4;
        border-bottom: 1px solid #1d242b;
        padding-bottom: 6px;
      }
      :global(.k-absensi-count) {
        color: #fab219;
        font-weight: 600;
      }

      :global(.k-legend) {
        display: flex;
        gap: 14px;
        flex-wrap: wrap;
        padding: 0 4px 4px;
        font-family: "IBM Plex Mono", monospace;
        font-size: 10.5px;
        color: #8b98a3;
      }
      :global(.k-legend span) {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      :global(.k-legend i) {
        width: 9px;
        height: 9px;
        border-radius: 2px;
        display: inline-block;
      }
      :global(.k-legend-ghost) {
        background: transparent;
        border: 1.5px dashed #57616b;
      }
      :global(.k-empty) {
        color: #57616b;
        font-family: "IBM Plex Mono", monospace;
        font-size: 12px;
      }

      :global(.k-table-wrap) {
        overflow-x: auto;
      }
      :global(.k-table) {
        width: 100%;
        border-collapse: collapse;
        font-family: "IBM Plex Mono", monospace;
        font-size: 12.5px;
      }
      :global(.k-table thead th) {
        text-align: left;
        color: #57616b;
        padding: 6px 10px;
        font-weight: 500;
        text-transform: uppercase;
        font-size: 10.5px;
        letter-spacing: 0.04em;
        border-bottom: 1px solid #262e37;
      }
      :global(.k-table .k-num) {
        text-align: right;
      }
      :global(.k-table tbody td) {
        padding: 7px 10px;
        border-top: 1px solid #1d242b;
        color: #c7ced4;
      }
      :global(.k-table .k-muted) {
        color: #8b98a3;
      }
      :global(.k-table .k-neg) {
        color: #ff8080;
      }
      :global(.k-empty-row) {
        padding: 12px 10px;
        color: #57616b;
      }

      :global(.k-footer) {
        margin-top: 26px;
        padding-top: 14px;
        border-top: 1px solid #1d242b;
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px;
        font-family: "IBM Plex Mono", monospace;
        font-size: 10px;
        color: #57616b;
        letter-spacing: 0.03em;
      }
      :global(.k-footer-brand) {
        display: flex;
        align-items: center;
        gap: 7px;
      }

      /* ---- Line Balancing calculator: form fields, editable table, suggestions ---- */
      :global(.k-param-row) {
        display: flex;
        gap: 20px;
        flex-wrap: wrap;
      }
      :global(.k-field) {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      :global(.k-field label) {
        font-family: "IBM Plex Mono", monospace;
        font-size: 10.5px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: #8b98a3;
      }
      :global(.k-hint) {
        font-family: "IBM Plex Mono", monospace;
        font-size: 9.5px;
        color: #57616b;
      }
      :global(.k-input) {
        background: #0d1115;
        border: 1px solid #262e37;
        border-radius: 3px;
        color: #eef3f5;
        font-family: "IBM Plex Mono", monospace;
        font-size: 14px;
        padding: 8px 10px;
        width: 100%;
      }
      :global(.k-input:focus) {
        outline: none;
        border-color: #2dd4bf;
        box-shadow: 0 0 0 2px rgba(45, 212, 191, 0.35);
      }
      :global(.k-panel-note) {
        font-family: "IBM Plex Mono", monospace;
        font-size: 10.5px;
        color: #57616b;
        line-height: 1.6;
        padding: 9px 12px;
        background: #0d1115;
        border: 1px solid #1d242b;
        border-radius: 3px;
        margin-bottom: 14px;
      }
      :global(.k-panel-note b) {
        color: #8b98a3;
      }

      :global(.k-lb-table) {
        min-width: 900px;
      }
      :global(.k-lb-table input.k-input) {
        min-width: 66px;
        font-size: 12.5px;
        padding: 6px 7px;
      }
      :global(.k-lb-table input.k-input.k-narrow) {
        width: 64px;
        min-width: 56px;
      }
      :global(.k-lb-table td.k-computed) {
        color: #8b98a3;
        text-align: right;
        white-space: nowrap;
        font-family: "IBM Plex Mono", monospace;
        font-size: 12px;
      }
      :global(.k-row-actions) {
        display: flex;
        gap: 6px;
      }
      :global(.k-icon-btn) {
        background: transparent;
        border: 1px solid #262e37;
        color: #8b98a3;
        border-radius: 3px;
        width: 26px;
        height: 26px;
        cursor: pointer;
        font-family: "IBM Plex Mono", monospace;
        font-size: 14px;
        line-height: 1;
      }
      :global(.k-icon-btn:hover) {
        border-color: #d03b3b;
        color: #d03b3b;
      }
      :global(.k-add-row-btn) {
        margin-top: 10px;
        background: transparent;
        border: 1px dashed #262e37;
        color: #8b98a3;
        border-radius: 3px;
        padding: 8px 14px;
        cursor: pointer;
        font-family: "IBM Plex Mono", monospace;
        font-size: 11.5px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        width: 100%;
      }
      :global(.k-add-row-btn:hover) {
        border-color: #2dd4bf;
        color: #2dd4bf;
      }

      :global(.k-suggestion) {
        display: flex;
        gap: 10px;
        padding: 10px 0;
        border-bottom: 1px solid #1d242b;
      }
      :global(.k-suggestion:last-child) {
        border-bottom: none;
      }
      :global(.k-suggestion-dot) {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex: none;
        margin-top: 5px;
      }
      :global(.k-suggestion-dot.split) {
        background: #d03b3b;
        box-shadow: 0 0 6px #d03b3b;
      }
      :global(.k-suggestion-dot.idle) {
        background: #fab219;
        box-shadow: 0 0 6px #fab219;
      }
      :global(.k-suggestion-txt) {
        font-size: 13px;
        color: #eef3f5;
        line-height: 1.5;
      }
      :global(.k-suggestion-txt b) {
        color: #2dd4bf;
      }
      :global(.k-suggestion-caveat) {
        display: block;
        font-family: "IBM Plex Mono", monospace;
        font-size: 10px;
        color: #57616b;
        margin-top: 3px;
      }
    `}</style>
  );
}
