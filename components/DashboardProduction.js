"use client";

const LOOKER_EMBED_URL =
  process.env.NEXT_PUBLIC_LOOKER_EMBED_URL ||
  "https://datastudio.google.com/embed/reporting/7d5af73c-9909-4c89-b8a0-58a91820257e/page/p_pcjxcdpc1d";

export default function DashboardProduction() {
  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--steel)",
        borderRadius: 4,
        padding: 8,
        minHeight: 600,
      }}
    >
      <iframe
        title="Looker Studio - Main Dashboard 2026"
        src={LOOKER_EMBED_URL}
        style={{
          width: "100%",
          height: "600px",
          border: "none",
          borderRadius: 2,
        }}
        allowFullScreen
      />
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--text-faint)",
          marginTop: 8,
          marginBottom: 0,
        }}
      >
        Jika laporan tidak muncul, pastikan laporan Looker Studio sudah di-share dengan akses
        &quot;Anyone with the link can view&quot;.
      </p>
    </div>
  );
}
