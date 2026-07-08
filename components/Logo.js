"use client";

export default function Logo({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" style={{ flexShrink: 0 }}>
      <rect width="44" height="44" rx="8" fill="var(--panel)" />
      <circle cx="14" cy="20" r="2.5" fill="var(--teal)" />
      <circle cx="22" cy="14" r="2.5" fill="var(--teal)" />
      <circle cx="30" cy="20" r="2.5" fill="var(--teal)" />
      <circle cx="22" cy="28" r="2.5" fill="var(--teal)" />
      <path d="M14 20 L22 14 L30 20 L22 28 Z" stroke="var(--teal)" strokeWidth="1.5" fill="none" />
    </svg>
  );
}
