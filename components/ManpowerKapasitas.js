"use client";

import Panel from "./Panel";

export default function ManpowerKapasitas() {
  return (
    <Panel title="Manpower dan Kapasitas">
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
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-muted)" }}>
          Tab ini belum terhubung ke data.
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-faint)", maxWidth: 420 }}>
          Menunggu struktur kolom dari tab Jam Kerja, Data Absensi, Kode Operator Cutting, dan
          Kapasitas Cutting.
        </div>
      </div>
    </Panel>
  );
}
