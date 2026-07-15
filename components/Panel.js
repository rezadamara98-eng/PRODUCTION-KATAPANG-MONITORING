"use client";

export default function Panel({ title, children, style }) {
  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--steel)",
        padding: title ? "0 0 16px" : "16px 20px",
        ...style,
      }}
    >
      {title && (
        <div
          style={{
            background: "var(--navy)",
            color: "#ffffff",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: "0.04em",
            padding: "9px 20px",
            marginBottom: 16,
            clipPath: "polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%)",
            textTransform: "uppercase",
          }}
        >
          {title}
        </div>
      )}
      <div style={{ padding: title ? "0 20px" : 0 }}>{children}</div>
    </div>
  );
}
