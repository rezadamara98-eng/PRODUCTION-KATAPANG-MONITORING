"use client";

import { useEffect, useState } from "react";
import Panel from "./Panel";

export default function AchievementPlanning() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/strong-point", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Gagal mengambil data");
        if (!cancelled) {
          setGroups(json.data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
        Mengambil data Strong Point Line dari Google Sheets...
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div
          style={{
            background: "rgba(193,68,14,0.12)",
            border: "1px solid var(--red)",
            color: "var(--text)",
            borderRadius: 4,
            padding: "14px 18px",
            marginBottom: 24,
            fontSize: 14,
          }}
        >
          <strong style={{ color: "var(--red)" }}>Gagal memuat data.</strong> {error}
        </div>
      )}

      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--text-faint)",
          marginBottom: 16,
        }}
      >
        {groups.length} style ditemukan &middot; menampilkan line yang bisa mengerjakan tiap style
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {groups.map((g) => (
          <Panel key={g.style} title={`${g.style}${g.buyer ? " \u00b7 " + g.buyer : ""}`}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: "var(--font-mono)",
                fontSize: 13,
              }}
            >
              <thead>
                <tr style={{ textAlign: "left", color: "var(--text-faint)" }}>
                  <th style={{ padding: "6px 10px" }}>Line</th>
                  <th style={{ padding: "6px 10px", textAlign: "right" }}>Target Kanan</th>
                  <th style={{ padding: "6px 10px", textAlign: "right" }}>Target Kiri</th>
                  <th style={{ padding: "6px 10px", textAlign: "right" }}>Aktual Kanan</th>
                  <th style={{ padding: "6px 10px", textAlign: "right" }}>Aktual Kiri</th>
                  <th style={{ padding: "6px 10px", textAlign: "right" }}>Efisiensi Kanan</th>
                  <th style={{ padding: "6px 10px", textAlign: "right" }}>Efisiensi Kiri</th>
                </tr>
              </thead>
              <tbody>
                {g.lines.map((l, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--steel)" }}>
                    <td style={{ padding: "6px 10px" }}>{l.line}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{l.targetKanan}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{l.targetKiri}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{l.actualKanan}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{l.actualKiri}</td>
                    <td
                      style={{
                        padding: "6px 10px",
                        textAlign: "right",
                        color: l.effKanan >= 100 ? "var(--green)" : l.effKanan >= 85 ? "var(--amber)" : "var(--red)",
                      }}
                    >
                      {l.effKanan.toFixed(1)}%
                    </td>
                    <td
                      style={{
                        padding: "6px 10px",
                        textAlign: "right",
                        color: l.effKiri >= 100 ? "var(--green)" : l.effKiri >= 85 ? "var(--amber)" : "var(--red)",
                      }}
                    >
                      {l.effKiri.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        ))}
        {groups.length === 0 && (
          <div style={{ color: "var(--text-faint)", fontSize: 13 }}>Belum ada data.</div>
        )}
      </div>
    </div>
  );
}
