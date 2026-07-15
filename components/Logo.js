"use client";

export default function Logo({ size = 44 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        background: "var(--navy)",
        clipPath: "polygon(20% 0, 100% 0, 100% 80%, 80% 100%, 0 100%, 0 20%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 44 44">
        <circle cx="14" cy="20" r="2.5" fill="var(--teal)" />
        <circle cx="22" cy="14" r="2.5" fill="var(--teal)" />
        <circle cx="30" cy="20" r="2.5" fill="var(--teal)" />
        <circle cx="22" cy="28" r="2.5" fill="var(--teal)" />
        <path d="M14 20 L22 14 L30 20 L22 28 Z" stroke="var(--teal)" strokeWidth="1.5" fill="none" />
      </svg>
    </div>
  );
}
