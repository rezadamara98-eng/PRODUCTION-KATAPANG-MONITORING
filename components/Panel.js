"use client";

export default function Panel({ title, children, style }) {
  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--steel)",
        borderRadius: 4,
        padding: "16px 20px",
        ...style,
      }}
    >
      {title && (
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 12,
            letterSpacing: "0.1em",
            color: "var(--text-faint)",
            textTransform: "uppercase",
            marginBottom: 14,
          }}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  );
}
