"use client";

import Panel from "./Panel";

export default function AchievementPlanning() {
  return (
    <Panel title="Planning vs Achievement">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 260,
          gap: 10,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            color: "var(--text-muted)",
          }}
        >
          Tab ini belum terhubung ke data planning.
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--text-faint)",
            maxWidth: 420,
          }}
        >
          Kirim struktur kolom (baris header) dari tab planning di Google Sheets kamu, nanti
          bagian ini akan diisi dengan grafik pencapaian target vs planning aktual.
        </div>
      </div>
    </Panel>
  );
}
