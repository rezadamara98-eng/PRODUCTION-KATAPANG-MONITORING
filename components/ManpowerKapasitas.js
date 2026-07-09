"use client";

import { useEffect, useState } from "react";
import KpiCard from "./KpiCard";
import Panel from "./Panel";

function safeFixed(val, digits = 1) {
  const n = Number(val);
  return Number.isFinite(n) ? n.toFixed(digits) : "-";
}

export default function ManpowerKapasitas() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/manpower", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Gagal mengambil data");
        if (!cancelled) {
          setData(json);
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
        Mengambil data Manpower dan Kapasitas dari Google Sheets...
      </div>
    );
  }

  const jamKerja = data?.jamKerja;
  const absensi = data?.absensi || [];
  const kapasitasCutting = data?.kapasitasCutting || [];
  const skillMatrik = data?.skillMatrik || [];
  const strongPoint = data?.strongPoint || [];

  const totalMp = absensi.length > 0 ? absensi[0].jumlahMp : 0;
  const totalAbsen = absensi.reduce((sum, r) => sum + r.jumlah, 0);
  const tingkatHadir = totalMp > 0 ? ((totalMp - totalAbsen) / totalMp) * 100 : 0;

  return (
    <div>
      {error && (
        <div
          style={{
            background: "rgba(217,83,79,0.12)",
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

      {/* Jam Kerja */}
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 12,
          letterSpacing: "0.1em",
          color: "var(--text-faint)",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        Jam Kerja per Departemen {jamKerja ? `- ${jamKerja.tanggal}` : ""}
      </p>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
        <KpiCard
          eyebrow="Supply"
          value={jamKerja ? `${safeFixed(jamKerja.smSupply, 0)} / ${safeFixed(jamKerja.actualSupply, 0)}` : "-"}
          tone={jamKerja && jamKerja.gapSupply >= 0 ? "green" : "red"}
        />
        <KpiCard
          eyebrow="Sewing"
          value={jamKerja ? `${safeFixed(jamKerja.smSewing, 0)} / ${safeFixed(jamKerja.actualSewing, 0)}` : "-"}
          tone={jamKerja && jamKerja.gapSewing >= 0 ? "green" : "red"}
        />
        <KpiCard
          eyebrow="Gudang Jadi"
          value={jamKerja ? `${safeFixed(jamKerja.smGudangJadi, 0)} / ${safeFixed(jamKerja.actualGudangJadi, 0)}` : "-"}
          tone={jamKerja && jamKerja.gapGudangJadi >= 0 ? "green" : "red"}
        />
        <KpiCard
          eyebrow="Support"
          value={jamKerja ? `${safeFixed(jamKerja.smSupport, 0)} / ${safeFixed(jamKerja.actualSupport, 0)}` : "-"}
          tone={jamKerja && jamKerja.gapSupport >= 0 ? "green" : "red"}
        />
      </div>

      {/* Absensi */}
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 12,
          letterSpacing: "0.1em",
          color: "var(--text-faint)",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        Absensi {absensi.length > 0 ? `- ${absensi[0].tanggal} (dari ${totalMp} MP)` : ""}
      </p>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
        {absensi.map((a) => (
          <KpiCard key={a.jenisAbsen} eyebrow={a.jenisAbsen} value={a.jumlah} tone={a.jumlah > 0 ? "red" : undefined} />
        ))}
        <KpiCard eyebrow="Tingkat Hadir" value={safeFixed(tingkatHadir, 1)} unit="%" tone="green" />
      </div>

      {/* Kapasitas Cutting */}
      <Panel title="Kapasitas Cutting per Operator (Top 10)" style={{ marginBottom: 24 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--text-faint)" }}>
              <th style={{ padding: "6px 10px" }}>Nama</th>
              <th style={{ padding: "6px 10px" }}>Line</th>
              <th style={{ padding: "6px 10px" }}>Style</th>
              <th style={{ padding: "6px 10px", textAlign: "right" }}>Kapasitas</th>
            </tr>
          </thead>
          <tbody>
            {kapasitasCutting.map((k, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--steel)" }}>
                <td style={{ padding: "6px 10px" }}>{k.nama}</td>
                <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>{k.line}</td>
                <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>{k.style}</td>
                <td style={{ padding: "6px 10px", textAlign: "right" }}>{k.kapasitas}</td>
              </tr>
            ))}
            {kapasitasCutting.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "12px 10px", color: "var(--text-faint)" }}>
                  Belum ada data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>

      {/* Skill Matrik Cutting */}
      <Panel title="Skill Matrik Cutting (Top 10)" style={{ marginBottom: 24 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--text-faint)" }}>
              <th style={{ padding: "6px 10px" }}>Nama</th>
              <th style={{ padding: "6px 10px" }}>Job</th>
              <th style={{ padding: "6px 10px", textAlign: "right" }}>Lama Kerja</th>
              <th style={{ padding: "6px 10px" }}>Pemahaman Artikel</th>
            </tr>
          </thead>
          <tbody>
            {skillMatrik.map((s, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--steel)" }}>
                <td style={{ padding: "6px 10px" }}>{s.nama}</td>
                <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>{s.job}</td>
                <td style={{ padding: "6px 10px", textAlign: "right" }}>{safeFixed(s.lamaBekerja, 1)} th</td>
                <td
                  style={{
                    padding: "6px 10px",
                    color:
                      s.pemahamanArtikel.toLowerCase().includes("kurang")
                        ? "var(--red)"
                        : s.pemahamanArtikel.toLowerCase() === "faham"
                        ? "var(--green)"
                        : "var(--text-muted)",
                  }}
                >
                  {s.pemahamanArtikel}
                </td>
              </tr>
            ))}
            {skillMatrik.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "12px 10px", color: "var(--text-faint)" }}>
                  Belum ada data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>

      {/* Strong Point Line */}
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 12,
          letterSpacing: "0.1em",
          color: "var(--text-faint)",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        Strong Point Line - dikelompokkan per Style
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {strongPoint.map((g) => (
          <Panel key={g.style} title={`${g.style}${g.buyer ? " \u00b7 " + g.buyer : ""}`}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--text-faint)" }}>
                  <th style={{ padding: "6px 10px" }}>Line</th>
                  <th style={{ padding: "6px 10px", textAlign: "right" }}>Target Kanan</th>
                  <th style={{ padding: "6px 10px", textAlign: "right" }}>Target Kiri</th>
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
                    <td
                      style={{
                        padding: "6px 10px",
                        textAlign: "right",
                        color: l.effKanan >= 100 ? "var(--green)" : l.effKanan >= 85 ? "var(--amber, #f2a900)" : "var(--red)",
                      }}
                    >
                      {safeFixed(l.effKanan, 1)}%
                    </td>
                    <td
                      style={{
                        padding: "6px 10px",
                        textAlign: "right",
                        color: l.effKiri >= 100 ? "var(--green)" : l.effKiri >= 85 ? "var(--amber, #f2a900)" : "var(--red)",
                      }}
                    >
                      {safeFixed(l.effKiri, 1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        ))}
        {strongPoint.length === 0 && (
          <div style={{ color: "var(--text-faint)", fontSize: 13 }}>Belum ada data.</div>
        )}
      </div>
    </div>
  );
}
