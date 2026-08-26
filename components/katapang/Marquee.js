"use client";

// Scrolling ticker used for the tab title in the HUD header. Two identical
// copies of the text sit back-to-back in a flex track; animating the track
// by exactly -50% loops seamlessly since both halves are the same width.
export default function Marquee({ text, width = 210, duration = 11 }) {
  return (
    <div
      style={{
        width,
        maxWidth: "46vw",
        overflow: "hidden",
        position: "relative",
        WebkitMaskImage:
          "linear-gradient(90deg, transparent 0, #000 18px, #000 calc(100% - 18px), transparent 100%)",
        maskImage:
          "linear-gradient(90deg, transparent 0, #000 18px, #000 calc(100% - 18px), transparent 100%)",
      }}
    >
      <div className="k-marquee-track" style={{ animationDuration: `${duration}s` }}>
        <span className="k-marquee-item">
          {text}
          <span className="k-marquee-sep">//</span>
        </span>
        <span className="k-marquee-item">
          {text}
          <span className="k-marquee-sep">//</span>
        </span>
      </div>
    </div>
  );
}
